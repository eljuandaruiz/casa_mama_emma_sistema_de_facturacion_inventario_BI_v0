import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Categorías de gasto DINÁMICAS (estilo app Wallet): el usuario crea las
 * suyas (muebles, pinturas, mejoras…) y todas quedan sujetas a la deducción
 * de IVA — la deducibilidad se decide por gasto, no por categoría.
 */

/** GET /api/gastos/categorias — categorías activas ordenadas por etiqueta. */
export async function GET() {
  const cats = await prisma.categoriaGasto.findMany({
    where: { activa: true },
    orderBy: { etiqueta: 'asc' },
  });
  return NextResponse.json(cats);
}

const schema = z.object({
  etiqueta: z.string().trim().min(2).max(60),
  icono: z.string().max(8).optional(),
});

/** POST /api/gastos/categorias — crea una categoría propia. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  // Slug estable a partir de la etiqueta: "Plantas y jardín" -> "PLANTAS_Y_JARDIN"
  const valor = parsed.data.etiqueta
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')
    .slice(0, 40);
  if (!valor) return NextResponse.json({ error: 'Etiqueta inválida' }, { status: 400 });

  const existente = await prisma.categoriaGasto.findUnique({ where: { valor } });
  if (existente) {
    if (!existente.activa) {
      const c = await prisma.categoriaGasto.update({ where: { valor }, data: { activa: true } });
      return NextResponse.json(c, { status: 201 });
    }
    return NextResponse.json({ error: 'Esa categoría ya existe' }, { status: 409 });
  }

  const c = await prisma.categoriaGasto.create({
    data: { valor, etiqueta: parsed.data.etiqueta, icono: parsed.data.icono || null },
  });
  return NextResponse.json(c, { status: 201 });
}

/** DELETE /api/gastos/categorias?id=1 — desactiva (los gastos históricos la conservan). */
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  await prisma.categoriaGasto.update({ where: { id }, data: { activa: false } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
