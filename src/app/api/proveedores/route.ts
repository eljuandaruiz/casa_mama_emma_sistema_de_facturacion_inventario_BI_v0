import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { validarRuc } from '@/lib/sri/catalogos';

export const dynamic = 'force-dynamic';

/** GET /api/proveedores — directorio de proveedores. */
export async function GET() {
  const proveedores = await prisma.proveedor.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { compras: true } } },
  });
  return NextResponse.json(
    proveedores.map((p) => ({ ...p, nCompras: p._count.compras })),
  );
}

const schema = z.object({
  nombre: z.string().trim().min(2).max(100),
  ruc: z.string().trim().max(13).optional().or(z.literal('')),
  categoria: z.enum(['FERRETERIA', 'MUEBLES', 'INSUMOS', 'SERVICIOS', 'OTROS']).default('OTROS'),
  telefono: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  direccion: z.string().trim().max(200).optional().or(z.literal('')),
  notas: z.string().trim().max(300).optional().or(z.literal('')),
});

/** POST /api/proveedores — crea un proveedor (valida RUC si se proporciona). */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const d = parsed.data;
  if (d.ruc && !validarRuc(d.ruc)) {
    return NextResponse.json({ error: 'El RUC del proveedor no es válido' }, { status: 400 });
  }
  const p = await prisma.proveedor.create({
    data: {
      nombre: d.nombre,
      ruc: d.ruc || null,
      categoria: d.categoria,
      telefono: d.telefono || null,
      email: d.email || null,
      direccion: d.direccion || null,
      notas: d.notas || null,
    },
  });
  return NextResponse.json(p, { status: 201 });
}
