import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

/** GET /api/lavanderia — ciclos de lavado + totales del mes en curso. */
export async function GET() {
  const ciclos = await prisma.cicloLavado.findMany({ orderBy: { fecha: 'desc' }, take: 200 });

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const delMes = ciclos.filter((c) => c.fecha >= inicioMes);

  return NextResponse.json({
    ciclos,
    resumenMes: {
      ciclos: delMes.length,
      piezas: delMes.reduce((a, c) => a + c.cantidad, 0),
      costo: round2(delMes.reduce((a, c) => a + c.costoTotal, 0)),
    },
  });
}

const schema = z.object({
  fecha: z.string().optional(),
  tipoLenceria: z.enum(['SABANAS', 'TOALLAS', 'COBIJAS', 'MIXTO']).default('MIXTO'),
  cantidad: z.coerce.number().int().min(0).default(0),
  costoJabon: z.coerce.number().min(0).default(0),
  costoAguaLuz: z.coerce.number().min(0).default(0),
  notas: z.string().max(200).optional(),
});

/** POST /api/lavanderia — registra un ciclo de lavado con sus costos. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const d = parsed.data;
  const costoTotal = round2(d.costoJabon + d.costoAguaLuz);
  const c = await prisma.cicloLavado.create({
    data: {
      fecha: d.fecha ? new Date(d.fecha) : new Date(),
      // El campo del schema se llama tipoLencerria (typo histórico conservado).
      tipoLencerria: d.tipoLenceria,
      cantidad: d.cantidad,
      costoJabon: d.costoJabon,
      costoAguaLuz: d.costoAguaLuz,
      costoTotal,
      notas: d.notas || null,
    },
  });
  return NextResponse.json({ id: c.id, costoTotal }, { status: 201 });
}
