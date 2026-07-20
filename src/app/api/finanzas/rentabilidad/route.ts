import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finanzas/rentabilidad?mes=2026-07
 *
 * Rentabilidad (UTILIDAD BRUTA) por factura del mes:
 *
 *   Utilidad = Ingreso neto − (Costo consumibles + Costo fijo prorrateado)
 *
 * PRORRATEO DE COSTOS FIJOS (algoritmo):
 *   1. Se suman los gastos FIJOS del mes (agua, luz, internet → categoría
 *      SERVICIOS_BASICOS y FIJOS_UTILIDADES).
 *   2. Ese total se reparte equitativamente entre TODAS las facturas no
 *      anuladas del mes:  costoFijoPorFactura = totalFijo / nFacturas.
 *   (Reparto equitativo por estadía; simple y auditable. Si en el futuro se
 *    quiere prorratear por noches, se cambia el divisor por el total de noches.)
 */
export async function GET(req: Request) {
  const mes = new URL(req.url).searchParams.get('mes') ?? new Date().toISOString().slice(0, 7);
  const [y, m] = mes.split('-').map(Number);
  const desde = new Date(y, m - 1, 1);
  const hasta = new Date(y, m, 1);

  // Facturas del mes (no anuladas).
  const facturas = await prisma.factura.findMany({
    where: { fechaEmision: { gte: desde, lt: hasta }, anulada: false },
    include: { cliente: { select: { razonSocial: true } } },
    orderBy: { fechaEmision: 'asc' },
  });

  // Gastos fijos del mes (servicios básicos / utilidades).
  const gastosFijos = await prisma.gasto.findMany({
    where: {
      fecha: { gte: desde, lt: hasta },
      categoria: { in: ['SERVICIOS_BASICOS', 'FIJOS_UTILIDADES'] },
    },
    select: { total: true, descripcion: true },
  });
  const totalFijo = round2(gastosFijos.reduce((a, g) => a + g.total, 0));

  // Prorrateo equitativo entre facturas del mes.
  const nFacturas = facturas.length;
  const costoFijoPorFactura = nFacturas > 0 ? round2(totalFijo / nFacturas) : 0;

  const detalle = facturas.map((f) => {
    // Ingreso neto = subtotal sin impuestos (lo que realmente entra, sin IVA).
    const ingresoNeto = f.subtotalSinImpuestos;
    const costoConsumibles = f.costoConsumibles;
    const utilidadBruta = round2(ingresoNeto - costoConsumibles - costoFijoPorFactura);
    const margenPct = ingresoNeto > 0 ? Math.round((utilidadBruta / ingresoNeto) * 100) : 0;
    return {
      id: f.id,
      numeroCompleto: f.numeroCompleto,
      cliente: f.cliente.razonSocial,
      ingresoNeto: round2(ingresoNeto),
      costoConsumibles: round2(costoConsumibles),
      costoFijoProrrateado: costoFijoPorFactura,
      utilidadBruta,
      margenPct,
    };
  });

  return NextResponse.json({
    mes,
    totalFijo,
    nFacturas,
    costoFijoPorFactura,
    utilidadTotal: round2(detalle.reduce((a, d) => a + d.utilidadBruta, 0)),
    detalle,
  });
}
