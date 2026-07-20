import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

/**
 * Histórico mensual de servicios básicos (agua, luz, internet, teléfono…).
 * Permite cargar valores de meses ANTERIORES para ver la evolución.
 */

/** GET /api/rimpe/servicios — todo el histórico, agrupado por mes para graficar. */
export async function GET() {
  const filas = await prisma.servicioBasicoMes.findMany({ orderBy: { mes: 'asc' } });
  // Pivot: [{ mes, AGUA, LUZ, INTERNET, TELEFONO, ... , total }]
  const meses = new Map<string, Record<string, number | string>>();
  for (const s of filas) {
    const fila = meses.get(s.mes) ?? { mes: s.mes };
    fila[s.tipo] = s.valor;
    meses.set(s.mes, fila);
  }
  const serie = [...meses.values()].map((fila) => ({
    ...fila,
    total: round2(
      Object.entries(fila)
        .filter(([k]) => k !== 'mes')
        .reduce((a, [, v]) => a + Number(v), 0),
    ),
  }));
  return NextResponse.json({ filas, serie });
}

const schema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  tipo: z.enum(['AGUA', 'LUZ', 'INTERNET', 'TELEFONO', 'GAS', 'OTRO']),
  valor: z.number().min(0),
});

/** POST /api/rimpe/servicios — upsert del valor del mes (histórico o actual). */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const { mes, tipo, valor } = parsed.data;
  const s = await prisma.servicioBasicoMes.upsert({
    where: { mes_tipo: { mes, tipo } },
    update: { valor: round2(valor) },
    create: { mes, tipo, valor: round2(valor) },
  });
  return NextResponse.json(s, { status: 201 });
}

/** DELETE /api/rimpe/servicios?id=1 */
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  await prisma.servicioBasicoMes.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
