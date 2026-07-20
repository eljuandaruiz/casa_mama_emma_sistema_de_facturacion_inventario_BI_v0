import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * CATÁLOGO DE PRODUCTOS/SERVICIOS — base escalable para facturar cualquier
 * cosa por el SRI (hoy: servicios extra del hospedaje; mañana: productos DTF,
 * zapatos, etc.). El `codigo` se usa como codigoPrincipal en el XML.
 */

/** GET /api/productos — catálogo activo (o todo con ?todos=1). */
export async function GET(req: Request) {
  const todos = new URL(req.url).searchParams.get('todos') === '1';
  const productos = await prisma.producto.findMany({
    where: todos ? {} : { activo: true },
    orderBy: { descripcion: 'asc' },
  });
  return NextResponse.json(productos);
}

const crear = z.object({
  codigo: z.string().trim().min(2).max(25).regex(/^[A-Za-z0-9-]+$/, 'Solo letras, números y guiones'),
  descripcion: z.string().trim().min(2).max(120),
  precioUnitario: z.number().min(0),
  codigoIva: z.enum(['4', '8', '0']).default('4'),
});

/** POST /api/productos — crea un producto/servicio. */
export async function POST(req: Request) {
  const parsed = crear.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }
  const codigo = parsed.data.codigo.toUpperCase();
  const existente = await prisma.producto.findUnique({ where: { codigo } });
  if (existente) return NextResponse.json({ error: `El código ${codigo} ya existe` }, { status: 409 });

  const p = await prisma.producto.create({ data: { ...parsed.data, codigo } });
  return NextResponse.json(p, { status: 201 });
}

const editar = z.object({
  id: z.number().int(),
  descripcion: z.string().trim().min(2).max(120).optional(),
  precioUnitario: z.number().min(0).optional(),
  codigoIva: z.enum(['4', '8', '0']).optional(),
  activo: z.boolean().optional(),
});

/** PATCH /api/productos — edita precio/descripcion/IVA o desactiva. */
export async function PATCH(req: Request) {
  const parsed = editar.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const { id, ...data } = parsed.data;
  const p = await prisma.producto.update({ where: { id }, data });
  return NextResponse.json(p);
}
