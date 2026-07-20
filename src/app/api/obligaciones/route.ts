import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { diasRestantes, nivelAlerta, siguienteVencimiento } from '@/lib/obligaciones';

export const dynamic = 'force-dynamic';

/** GET /api/obligaciones — obligaciones activas con días restantes y alerta. */
export async function GET() {
  const obligaciones = await prisma.obligacion.findMany({
    where: { activa: true },
    orderBy: { proximoVencimiento: 'asc' },
  });
  return NextResponse.json(
    obligaciones.map((o) => {
      const dias = diasRestantes(o.proximoVencimiento);
      return { ...o, dias, alerta: nivelAlerta(dias) };
    }),
  );
}

const crear = z.object({
  nombre: z.string().trim().min(2).max(100),
  tipo: z.enum(['IMPUESTO', 'MUNICIPAL', 'PERMISO', 'OTRO']).default('IMPUESTO'),
  proximoVencimiento: z.string(), // ISO date
  recurrencia: z.enum(['MENSUAL', 'SEMESTRAL', 'ANUAL', 'UNICA']).default('ANUAL'),
  entidad: z.string().max(80).optional(),
  notas: z.string().max(300).optional(),
});

/** POST /api/obligaciones — crea una obligación. */
export async function POST(req: Request) {
  const parsed = crear.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const d = parsed.data;
  const o = await prisma.obligacion.create({
    data: {
      nombre: d.nombre,
      tipo: d.tipo,
      proximoVencimiento: new Date(d.proximoVencimiento),
      recurrencia: d.recurrencia,
      entidad: d.entidad || null,
      notas: d.notas || null,
    },
  });
  return NextResponse.json(o, { status: 201 });
}

const cumplir = z.object({ id: z.number().int() });

/** PATCH /api/obligaciones — marca cumplida y avanza a la siguiente fecha. */
export async function PATCH(req: Request) {
  const parsed = cumplir.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const o = await prisma.obligacion.findUnique({ where: { id: parsed.data.id } });
  if (!o) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const proxima = siguienteVencimiento(o.proximoVencimiento, o.recurrencia);
  const actualizada = await prisma.obligacion.update({
    where: { id: o.id },
    data: {
      ultimoPago: new Date(),
      proximoVencimiento: proxima,
      // Una obligación de pago único se desactiva tras cumplirse.
      activa: o.recurrencia !== 'UNICA',
    },
  });
  return NextResponse.json({ ok: true, obligacion: actualizada });
}
