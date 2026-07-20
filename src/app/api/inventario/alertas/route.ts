import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inventario/alertas — artículos activos cuyo stock cayó al nivel de
 * alerta (stock <= stockMinimo, que sembramos ~25% del stock habitual). Alimenta
 * el banner global "Reponer: [artículo]" visible en toda la app.
 */
export async function GET() {
  const articulos = await prisma.articuloInventario.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, stock: true, stockMinimo: true, unidad: true },
    orderBy: { nombre: 'asc' },
  });
  const bajos = articulos.filter((a) => a.stock <= a.stockMinimo);
  return NextResponse.json(bajos);
}
