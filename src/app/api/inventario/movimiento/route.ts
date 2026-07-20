import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

const schema = z.object({
  articuloId: z.number().int(),
  tipo: z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']),
  cantidad: z.coerce.number().positive(),
  motivo: z.string().trim().max(200).optional(),
});

/**
 * POST /api/inventario/movimiento — registra entrada/salida/ajuste y actualiza
 * el stock de forma atómica (transacción). ENTRADA suma, SALIDA resta, AJUSTE
 * fija el stock al valor dado.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const { articuloId, tipo, cantidad, motivo } = parsed.data;

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const art = await tx.articuloInventario.findUniqueOrThrow({ where: { id: articuloId } });
      let nuevoStock: number;
      if (tipo === 'ENTRADA') nuevoStock = art.stock + cantidad;
      else if (tipo === 'SALIDA') nuevoStock = art.stock - cantidad;
      else nuevoStock = cantidad; // AJUSTE: fija el stock
      if (nuevoStock < 0) throw new Error('El stock no puede quedar negativo');
      nuevoStock = round2(nuevoStock);

      await tx.articuloInventario.update({ where: { id: articuloId }, data: { stock: nuevoStock } });
      await tx.movimientoInventario.create({
        data: { articuloId, tipo, cantidad, motivo: motivo || null, stockResultante: nuevoStock },
      });
      return { stock: nuevoStock, bajoMinimo: nuevoStock <= art.stockMinimo };
    });
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
