import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finanzas/rango?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *
 * Finanzas por PERÍODO ACOTADO (semana, mes, año o "de tal día a tal día"):
 * ingresos (facturas no anuladas) + ingresos RIMPE simples, egresos (gastos),
 * utilidad, nº de facturas, y KPIs de contexto: promedio de ingreso mensual
 * del año en curso e ingresos de los últimos 30 días.
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const hoy = new Date();
  const desde = p.get('desde') ? new Date(`${p.get('desde')}T00:00:00`) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const hastaDia = p.get('hasta') ? new Date(`${p.get('hasta')}T00:00:00`) : hoy;
  const hasta = new Date(hastaDia.getTime() + 86_400_000); // inclusivo

  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || desde >= hasta) {
    return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 });
  }

  const hace30 = new Date(hoy.getTime() - 30 * 86_400_000);
  const inicioAnio = new Date(hoy.getFullYear(), 0, 1);

  const [facturas, ingresosSimples, gastos, facturas30, simples30, facturasAnio, simplesAnio] = await Promise.all([
    prisma.factura.findMany({
      where: { fechaEmision: { gte: desde, lt: hasta }, anulada: false },
      select: { subtotalSinImpuestos: true, importeTotal: true, costoConsumibles: true },
    }),
    prisma.ingresoSimple.findMany({ where: { fecha: { gte: desde, lt: hasta } }, select: { monto: true } }),
    prisma.gasto.findMany({ where: { fecha: { gte: desde, lt: hasta } }, select: { total: true } }),
    prisma.factura.aggregate({ where: { fechaEmision: { gte: hace30 }, anulada: false }, _sum: { subtotalSinImpuestos: true } }),
    prisma.ingresoSimple.aggregate({ where: { fecha: { gte: hace30 } }, _sum: { monto: true } }),
    prisma.factura.aggregate({ where: { fechaEmision: { gte: inicioAnio }, anulada: false }, _sum: { subtotalSinImpuestos: true } }),
    prisma.ingresoSimple.aggregate({ where: { fecha: { gte: inicioAnio } }, _sum: { monto: true } }),
  ]);

  const ingresosFacturados = round2(facturas.reduce((a, f) => a + f.subtotalSinImpuestos, 0));
  const ingresosRimpe = round2(ingresosSimples.reduce((a, i) => a + i.monto, 0));
  const ingresos = round2(ingresosFacturados + ingresosRimpe);
  const egresos = round2(gastos.reduce((a, g) => a + g.total, 0));
  const costoAmenities = round2(facturas.reduce((a, f) => a + f.costoConsumibles, 0));

  // Promedio mensual del año: total del año ÷ meses transcurridos.
  const mesesTranscurridos = hoy.getMonth() + 1;
  const totalAnio = round2((facturasAnio._sum.subtotalSinImpuestos ?? 0) + (simplesAnio._sum.monto ?? 0));

  return NextResponse.json({
    desde: desde.toISOString().slice(0, 10),
    hasta: hastaDia.toISOString().slice(0, 10),
    ingresos,
    ingresosFacturados,
    ingresosRimpe,
    egresos,
    utilidad: round2(ingresos - egresos),
    nFacturas: facturas.length,
    nIngresosSimples: ingresosSimples.length,
    costoAmenities,
    ultimos30dias: round2((facturas30._sum.subtotalSinImpuestos ?? 0) + (simples30._sum.monto ?? 0)),
    promedioMensualAnio: mesesTranscurridos > 0 ? round2(totalAnio / mesesTranscurridos) : 0,
    totalAnio,
  });
}
