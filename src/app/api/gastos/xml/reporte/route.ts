import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gastos/xml/reporte?mes=2026-07
 *
 * Reporte agregado de gastos (facilita la declaración MANUAL en el SRI: el
 * SRI no ofrece una API para subir gastos directo a la declaración personal,
 * así que este resumen es lo que el usuario transcribe al formulario 104/ATS).
 */
export async function GET(req: Request) {
  const mes = new URL(req.url).searchParams.get('mes') ?? new Date().toISOString().slice(0, 7);
  const [y, m] = mes.split('-').map(Number);
  const desde = new Date(y, m - 1, 1);
  const hasta = new Date(y, m, 1);

  const gastos = await prisma.gasto.findMany({
    where: { fecha: { gte: desde, lt: hasta } },
    orderBy: { fecha: 'asc' },
  });

  const deducibles = gastos.filter((g) => g.deducible);
  const noDeducibles = gastos.filter((g) => !g.deducible);

  const porCategoria = new Map<string, { categoria: string; n: number; subtotal: number; iva: number; total: number }>();
  for (const g of deducibles) {
    const c = porCategoria.get(g.categoria) ?? { categoria: g.categoria, n: 0, subtotal: 0, iva: 0, total: 0 };
    c.n += 1;
    c.subtotal += g.subtotal;
    c.iva += g.iva;
    c.total += g.total;
    porCategoria.set(g.categoria, c);
  }

  return NextResponse.json({
    mes,
    totales: {
      nGastos: gastos.length,
      nDeducibles: deducibles.length,
      nNoDeducibles: noDeducibles.length,
      subtotalDeducible: round2(deducibles.reduce((a, g) => a + g.subtotal, 0)),
      ivaDeducible: round2(deducibles.reduce((a, g) => a + g.iva, 0)),
      totalDeducible: round2(deducibles.reduce((a, g) => a + g.total, 0)),
      totalNoDeducible: round2(noDeducibles.reduce((a, g) => a + g.total, 0)),
    },
    porCategoria: [...porCategoria.values()]
      .map((c) => ({ ...c, subtotal: round2(c.subtotal), iva: round2(c.iva), total: round2(c.total) }))
      .sort((a, b) => b.total - a.total),
    detalle: gastos.map((g) => ({
      id: g.id,
      fecha: g.fecha,
      proveedor: g.proveedor,
      rucProveedor: g.rucProveedor,
      numeroComprobante: g.numeroComprobante,
      categoria: g.categoria,
      subtotal: g.subtotal,
      iva: g.iva,
      total: g.total,
      deducible: g.deducible,
    })),
  });
}
