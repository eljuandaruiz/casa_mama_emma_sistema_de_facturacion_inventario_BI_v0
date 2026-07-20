import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

/**
 * RIMPE — control simple SIN facturación electrónica.
 * Mientras el negocio esté en régimen RIMPE Emprendedor (hasta $20,000/año de
 * ingresos) se registran estadías cobradas sin factura, y se cruza contra
 * gastos y servicios básicos para saber cuánto cuesta y cuánto genera cada
 * habitación. Todo suma también al techo anual del RIMPE.
 */

const LIMITE_RIMPE_ANUAL = 20_000;

/** GET /api/rimpe?anio=2026 — ingresos simples + resumen por habitación + techo RIMPE. */
export async function GET(req: Request) {
  const anio = Number(new URL(req.url).searchParams.get('anio') ?? new Date().getFullYear());
  const desde = new Date(anio, 0, 1);
  const hasta = new Date(anio + 1, 0, 1);

  const [ingresos, facturados, gastosAnio, servicios] = await Promise.all([
    prisma.ingresoSimple.findMany({ where: { fecha: { gte: desde, lt: hasta } }, orderBy: { fecha: 'desc' }, take: 200 }),
    prisma.factura.aggregate({ where: { fechaEmision: { gte: desde, lt: hasta }, anulada: false }, _sum: { subtotalSinImpuestos: true } }),
    prisma.gasto.aggregate({ where: { fecha: { gte: desde, lt: hasta } }, _sum: { total: true } }),
    prisma.servicioBasicoMes.findMany({ where: { mes: { startsWith: String(anio) } }, orderBy: { mes: 'asc' } }),
  ]);

  // Resumen por habitación (ingresos simples del año).
  const porHabitacion = new Map<string, { habitacion: string; n: number; ingresos: number; noches: number; huespedes: number }>();
  for (const i of ingresos) {
    const clave = i.numeroHabitacion != null ? `Hab. ${i.numeroHabitacion}` : 'Casa completa / otro';
    const g = porHabitacion.get(clave) ?? { habitacion: clave, n: 0, ingresos: 0, noches: 0, huespedes: 0 };
    g.n += 1;
    g.ingresos += i.monto;
    g.noches += i.noches;
    g.huespedes += i.huespedes;
    porHabitacion.set(clave, g);
  }

  const totalSimples = round2(ingresos.reduce((a, i) => a + i.monto, 0));
  const totalFacturado = round2(facturados._sum.subtotalSinImpuestos ?? 0);
  const totalAnual = round2(totalSimples + totalFacturado);

  return NextResponse.json({
    anio,
    limiteRimpe: LIMITE_RIMPE_ANUAL,
    totalAnual,
    totalSimples,
    totalFacturado,
    pctLimite: Math.min(100, Math.round((totalAnual / LIMITE_RIMPE_ANUAL) * 100)),
    gastosAnio: round2(gastosAnio._sum.total ?? 0),
    utilidadAnio: round2(totalAnual - (gastosAnio._sum.total ?? 0)),
    porHabitacion: [...porHabitacion.values()]
      .map((g) => ({
        ...g,
        ingresos: round2(g.ingresos),
        promedioPorNoche: g.noches > 0 ? round2(g.ingresos / g.noches) : 0,
        promedioPorEstadia: g.n > 0 ? round2(g.ingresos / g.n) : 0,
      }))
      .sort((a, b) => b.ingresos - a.ingresos),
    ingresos,
    servicios,
  });
}

const crearIngreso = z.object({
  fecha: z.string().min(1),
  numeroHabitacion: z.coerce.number().int().min(0).max(99).optional(), // 0/vacío = casa completa
  huespedes: z.coerce.number().int().min(1).max(30).default(1),
  noches: z.coerce.number().int().min(1).max(365).default(1),
  monto: z.number().positive(),
  canal: z.enum(['DIRECTO', 'AIRBNB', 'BOOKING', 'OTRO']).default('DIRECTO'),
  notas: z.string().max(200).optional(),
});

/** POST /api/rimpe — registra un ingreso sin factura. */
export async function POST(req: Request) {
  const parsed = crearIngreso.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const d = parsed.data;
  const ingreso = await prisma.ingresoSimple.create({
    data: {
      fecha: new Date(d.fecha),
      numeroHabitacion: d.numeroHabitacion || null,
      huespedes: d.huespedes,
      noches: d.noches,
      monto: round2(d.monto),
      canal: d.canal,
      notas: d.notas || null,
    },
  });
  return NextResponse.json(ingreso, { status: 201 });
}

/** DELETE /api/rimpe?id=1 — elimina un ingreso mal registrado. */
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  await prisma.ingresoSimple.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
