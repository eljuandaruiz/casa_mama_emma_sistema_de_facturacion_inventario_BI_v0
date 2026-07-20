import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * PRESETS DE TARIFA — ganancia NETA deseada por persona/noche ("quiero ganar
 * $11 por persona; $15 en feriado…"). El formulario de factura los muestra
 * como chips de selección rápida y calcula el precio según el canal.
 */

/** GET /api/tarifas — presets activos en orden. */
export async function GET() {
  const presets = await prisma.tarifaPreset.findMany({
    where: { activa: true },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
  });
  return NextResponse.json(presets);
}

const crear = z.object({
  nombre: z.string().trim().min(2).max(50),
  gananciaPorPersona: z.number().positive().max(1000),
});

/** POST /api/tarifas — nuevo preset. */
export async function POST(req: Request) {
  const parsed = crear.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const max = await prisma.tarifaPreset.aggregate({ _max: { orden: true } });
  const p = await prisma.tarifaPreset.create({
    data: { ...parsed.data, orden: (max._max.orden ?? 0) + 1 },
  });
  return NextResponse.json(p, { status: 201 });
}

const editar = z.object({
  id: z.number().int(),
  nombre: z.string().trim().min(2).max(50).optional(),
  gananciaPorPersona: z.number().positive().max(1000).optional(),
  activa: z.boolean().optional(),
});

/** PATCH /api/tarifas — edita o desactiva un preset. */
export async function PATCH(req: Request) {
  const parsed = editar.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const { id, ...data } = parsed.data;
  const p = await prisma.tarifaPreset.update({ where: { id }, data });
  return NextResponse.json(p);
}
