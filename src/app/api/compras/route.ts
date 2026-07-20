import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { calcularDepreciacion, categoriaCompra } from '@/lib/depreciacion';
import { etiquetaArea } from '@/lib/areas';

export const dynamic = 'force-dynamic';

/** GET /api/compras — compras con su depreciación calculada a la fecha actual. */
export async function GET() {
  const compras = await prisma.compra.findMany({
    orderBy: { fechaCompra: 'desc' },
    include: { proveedor: { select: { nombre: true } } },
    take: 300,
  });
  return NextResponse.json(
    compras.map((c) => {
      const total = c.costo * c.cantidad;
      const dep = calcularDepreciacion(total, c.categoria, c.fechaCompra);
      const cat = categoriaCompra(c.categoria);
      return {
        id: c.id,
        descripcion: c.descripcion,
        categoria: c.categoria,
        categoriaEtiqueta: cat.etiqueta,
        esActivo: cat.esActivo,
        area: c.area,
        areaEtiqueta: etiquetaArea(c.area),
        costo: c.costo,
        cantidad: c.cantidad,
        total: Math.round(total * 100) / 100,
        numeroFactura: c.numeroFactura,
        fechaCompra: c.fechaCompra,
        proveedor: c.proveedor?.nombre ?? null,
        depreciacion: dep,
      };
    }),
  );
}

const schema = z.object({
  descripcion: z.string().trim().min(2).max(120),
  categoria: z.string().min(2).max(30),
  area: z.string().max(20).optional(),
  costo: z.coerce.number().min(0),
  cantidad: z.coerce.number().min(0.01).default(1),
  numeroFactura: z.string().max(40).optional(),
  fechaCompra: z.string().optional(),
  proveedorId: z.coerce.number().int().optional(),
  notas: z.string().max(300).optional(),
});

/** POST /api/compras — registra una compra. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const d = parsed.data;
  const compra = await prisma.compra.create({
    data: {
      descripcion: d.descripcion,
      categoria: d.categoria,
      area: d.area || null,
      costo: d.costo,
      cantidad: d.cantidad,
      numeroFactura: d.numeroFactura || null,
      fechaCompra: d.fechaCompra ? new Date(d.fechaCompra) : new Date(),
      proveedorId: d.proveedorId ?? null,
      notas: d.notas || null,
    },
  });
  return NextResponse.json({ id: compra.id }, { status: 201 });
}
