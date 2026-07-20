import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finanzas?anio=2026 — Dashboard financiero maestro.
 * Cruza INGRESOS (facturas emitidas, no anuladas) contra EGRESOS
 * (gastos + mantenimiento + compras) y PROYECTA las obligaciones tributarias:
 *   - IVA a pagar (aprox) = IVA cobrado en ventas − IVA soportado en gastos
 *   - Base imponible de Renta ≈ ingresos gravados − gastos deducibles
 *   - Impuesto a la Renta proyectado (persona natural, tarifa efectiva simple)
 *
 * NOTA: es una PROYECCIÓN de apoyo, no la declaración oficial. La liquidación
 * real depende de deducciones personales, retenciones y la tabla del SRI.
 */

// Tarifa efectiva simple para proyectar Renta de persona natural. Ajustable.
// (La tabla real del SRI es progresiva por tramos; aquí una estimación.)
function rentaEstimada(baseImponible: number): number {
  if (baseImponible <= 11902) return 0; // fracción básica desgravada aprox.
  // Estimación conservadora del 5% sobre el excedente de la fracción básica.
  return round2((baseImponible - 11902) * 0.05);
}

export async function GET(req: Request) {
  const anio = Number(new URL(req.url).searchParams.get('anio') ?? new Date().getFullYear());
  const desde = new Date(anio, 0, 1);
  const hasta = new Date(anio + 1, 0, 1);

  const [facturas, gastos, mantenimientos, compras] = await Promise.all([
    prisma.factura.findMany({
      where: { fechaEmision: { gte: desde, lt: hasta }, anulada: false },
      select: { subtotalSinImpuestos: true, valorIva: true, importeTotal: true },
    }),
    prisma.gasto.findMany({
      where: { fecha: { gte: desde, lt: hasta } },
      select: { subtotal: true, iva: true, total: true, deducible: true },
    }),
    prisma.trabajoMantenimiento.findMany({
      where: { fecha: { gte: desde, lt: hasta } },
      select: { costoTotal: true },
    }),
    prisma.compra.findMany({
      where: { fechaCompra: { gte: desde, lt: hasta } },
      select: { costo: true, cantidad: true },
    }),
  ]);

  // ---------- Ingresos ----------
  const ingresosBase = round2(facturas.reduce((a, f) => a + f.subtotalSinImpuestos, 0));
  const ivaCobrado = round2(facturas.reduce((a, f) => a + f.valorIva, 0));
  const ingresosTotales = round2(facturas.reduce((a, f) => a + f.importeTotal, 0));

  // ---------- Egresos ----------
  const gastosBase = round2(gastos.reduce((a, g) => a + g.subtotal, 0));
  const ivaGastos = round2(gastos.reduce((a, g) => a + g.iva, 0));
  const gastosDeducibles = round2(gastos.filter((g) => g.deducible).reduce((a, g) => a + g.subtotal, 0));
  const totalMantenimiento = round2(mantenimientos.reduce((a, m) => a + m.costoTotal, 0));
  const totalCompras = round2(compras.reduce((a, c) => a + c.costo * c.cantidad, 0));

  const egresosTotales = round2(gastosBase + totalMantenimiento + totalCompras);

  // ---------- Proyección de impuestos ----------
  const ivaAPagar = round2(Math.max(0, ivaCobrado - ivaGastos));
  // Base de renta: ingresos gravados menos gastos deducibles (gastos + mantenimiento).
  const baseRenta = round2(Math.max(0, ingresosBase - gastosDeducibles - totalMantenimiento));
  const rentaProyectada = rentaEstimada(baseRenta);

  const utilidad = round2(ingresosBase - egresosTotales);

  return NextResponse.json({
    anio,
    ingresos: { base: ingresosBase, iva: ivaCobrado, total: ingresosTotales, nFacturas: facturas.length },
    egresos: {
      gastos: gastosBase,
      mantenimiento: totalMantenimiento,
      compras: totalCompras,
      total: egresosTotales,
    },
    utilidad,
    impuestos: {
      ivaCobrado,
      ivaGastos,
      ivaAPagar,
      baseRenta,
      rentaProyectada,
    },
  });
}
