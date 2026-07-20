import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

/**
 * AMENITIES POR HABITACIÓN — reglas de consumo automático.
 * Cada regla dice: "la habitación N consume X unidades de este artículo por
 * estadía" (numeroHabitacion=0 aplica a TODAS). Al emitir una factura, el
 * sistema descuenta el stock y suma el costo a `factura.costoConsumibles`
 * (ver procesoEmision paso 5b) — así cada factura sabe cuánto costó en
 * agua, champú, jabón, papel, etc.
 */

/** GET /api/inventario/consumibles — reglas con artículo y costo por estadía. */
export async function GET() {
  const reglas = await prisma.consumibleHabitacion.findMany({
    include: { articulo: { select: { id: true, nombre: true, unidad: true, valorUnitario: true, stock: true } } },
    orderBy: [{ numeroHabitacion: 'asc' }],
  });
  return NextResponse.json(
    reglas.map((r) => ({
      id: r.id,
      numeroHabitacion: r.numeroHabitacion,
      articuloId: r.articuloId,
      articulo: r.articulo.nombre,
      unidad: r.articulo.unidad,
      valorUnitario: r.articulo.valorUnitario,
      cantidad: r.cantidad,
      regla: r.regla,
      costoPorEstadia: round2(r.cantidad * r.articulo.valorUnitario),
      stock: r.articulo.stock,
    })),
  );
}

const schema = z.object({
  numeroHabitacion: z.number().int().min(0).max(99), // 0 = todas las habitaciones
  articuloId: z.number().int(),
  cantidad: z.number().positive(),
  // FIJO = por estadía | POR_PERSONA = × huéspedes | CADA_DOS = × ⌈huéspedes/2⌉
  regla: z.enum(['FIJO', 'POR_PERSONA', 'CADA_DOS']).default('FIJO'),
});

/** POST /api/inventario/consumibles — crea o actualiza (upsert) una regla. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const { numeroHabitacion, articuloId, cantidad, regla } = parsed.data;

  const articulo = await prisma.articuloInventario.findUnique({ where: { id: articuloId } });
  if (!articulo) return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });

  const fila = await prisma.consumibleHabitacion.upsert({
    where: { numeroHabitacion_articuloId: { numeroHabitacion, articuloId } },
    update: { cantidad, regla },
    create: { numeroHabitacion, articuloId, cantidad, regla },
  });
  return NextResponse.json(fila, { status: 201 });
}

/** DELETE /api/inventario/consumibles?id=1 — elimina una regla. */
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  await prisma.consumibleHabitacion.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
