import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/inventario — artículos con su stock y estado de alerta. */
export async function GET() {
  const articulos = await prisma.articuloInventario.findMany({
    where: { activo: true },
    orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
  });
  return NextResponse.json(
    articulos.map((a) => ({
      ...a,
      bajoMinimo: a.stock <= a.stockMinimo,
    })),
  );
}

const crear = z.object({
  nombre: z.string().trim().min(2).max(80),
  // Categoría libre (validada contra el catálogo de 15 en el frontend).
  categoria: z.string().trim().min(2).max(40).default('VARIOS'),
  unidad: z.string().trim().max(20).default('unidad'),
  stock: z.coerce.number().min(0).default(0),
  stockMinimo: z.coerce.number().min(0).default(0),
  valorUnitario: z.coerce.number().min(0).default(0),
  icono: z.string().max(40).optional(),
});

/** POST /api/inventario — crea un artículo. */
export async function POST(req: Request) {
  const parsed = crear.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const a = await prisma.articuloInventario.create({ data: parsed.data });
  return NextResponse.json(a, { status: 201 });
}

const editar = z.object({
  id: z.number().int(),
  nombre: z.string().trim().min(2).max(80).optional(),
  categoria: z.string().trim().min(2).max(40).optional(),
  unidad: z.string().trim().max(20).optional(),
  stockMinimo: z.coerce.number().min(0).optional(),
  valorUnitario: z.coerce.number().min(0).optional(),
  activo: z.boolean().optional(),
});

/** PATCH /api/inventario — edita un artículo (nombre, valor unitario, etc.). */
export async function PATCH(req: Request) {
  const parsed = editar.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const { id, ...data } = parsed.data;
  const a = await prisma.articuloInventario.update({ where: { id }, data });
  return NextResponse.json(a);
}
