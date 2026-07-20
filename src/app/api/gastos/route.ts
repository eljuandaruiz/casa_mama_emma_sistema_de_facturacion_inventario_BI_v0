import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

/** GET /api/gastos?mes=2026-07 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get('mes');
  let where = {};
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split('-').map(Number);
    where = { fecha: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } };
  }
  const gastos = await prisma.gasto.findMany({ where, orderBy: { fecha: 'desc' }, take: 300 });
  return NextResponse.json(gastos);
}

const gastoSchema = z.object({
  fecha: z.string(), // ISO
  // Categoría dinámica (tabla CategoriaGasto): slug en MAYUSCULAS_CON_GUION.
  categoria: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_]+$/),
  descripcion: z.string().min(2),
  proveedor: z.string().optional(),
  rucProveedor: z.string().optional(),
  numeroComprobante: z.string().optional(),
  subtotal: z.number().min(0),
  iva: z.number().min(0).default(0),
  formaPago: z.enum(['EFECTIVO', 'TRANSFERENCIA']).default('EFECTIVO'),
  deducible: z.boolean().default(true),
});

/** POST /api/gastos */
export async function POST(req: Request) {
  const parsed = gastoSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalle: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const gasto = await prisma.gasto.create({
    data: {
      fecha: new Date(d.fecha),
      categoria: d.categoria,
      descripcion: d.descripcion,
      proveedor: d.proveedor,
      rucProveedor: d.rucProveedor,
      numeroComprobante: d.numeroComprobante,
      subtotal: round2(d.subtotal),
      iva: round2(d.iva),
      total: round2(d.subtotal + d.iva),
      formaPago: d.formaPago,
      deducible: d.deducible,
    },
  });
  return NextResponse.json(gasto, { status: 201 });
}

/** DELETE /api/gastos?id=123 */
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  await prisma.gasto.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
