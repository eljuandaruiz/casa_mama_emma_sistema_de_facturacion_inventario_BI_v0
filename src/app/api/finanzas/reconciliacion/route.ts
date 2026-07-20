import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';
import { etiquetaArea } from '@/lib/areas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finanzas/reconciliacion?anio=2026
 *
 * CONCILIACIÓN de ciclo contable completo: cruza los comprobantes EMITIDOS
 * (ingresos, facturas autorizadas propias) contra los RECIBIDOS (egresos:
 * gastos, mantenimiento, compras, mejoras, lavandería) para calcular el neto.
 *
 * - "Emitidas" = facturas AUTORIZADAS por el SRI (auditables contra SRI en línea).
 *   Si aún no hay .p12, se incluyen también las no anuladas como referencia.
 * - Neto por HABITACIÓN: ingreso atribuido a cada habitación (por sus líneas de
 *   detalle) menos los egresos atribuibles a esa área (mantenimiento + mejoras).
 */
export async function GET(req: Request) {
  const anio = Number(new URL(req.url).searchParams.get('anio') ?? new Date().getFullYear());
  const desde = new Date(anio, 0, 1);
  const hasta = new Date(anio + 1, 0, 1);

  const [facturas, gastos, mantenimientos, compras, mejoras, habitaciones] = await Promise.all([
    prisma.factura.findMany({
      where: { fechaEmision: { gte: desde, lt: hasta }, anulada: false },
      include: { detalles: { include: { habitacion: true } } },
    }),
    prisma.gasto.findMany({ where: { fecha: { gte: desde, lt: hasta } }, select: { subtotal: true } }),
    prisma.trabajoMantenimiento.findMany({ where: { fecha: { gte: desde, lt: hasta } }, select: { costoTotal: true, area: true } }),
    prisma.compra.findMany({ where: { fechaCompra: { gte: desde, lt: hasta } }, select: { costo: true, cantidad: true } }),
    prisma.mejora.findMany({ where: { fecha: { gte: desde, lt: hasta } }, select: { costo: true, area: true } }),
    prisma.habitacion.findMany({ orderBy: { numero: 'asc' } }),
  ]);

  // ---------- Columna EMITIDAS (ingresos) ----------
  const autorizadas = facturas.filter((f) => f.estadoSri === 'AUTORIZADA');
  const emitidas = {
    autorizadas: autorizadas.length,
    total: facturas.length,
    ingresoAutorizado: round2(autorizadas.reduce((a, f) => a + f.subtotalSinImpuestos, 0)),
    ingresoTotal: round2(facturas.reduce((a, f) => a + f.subtotalSinImpuestos, 0)),
  };

  // ---------- Columna RECIBIDAS (egresos operativos) ----------
  const totalGastos = round2(gastos.reduce((a, g) => a + g.subtotal, 0));
  const totalMant = round2(mantenimientos.reduce((a, m) => a + m.costoTotal, 0));
  const totalCompras = round2(compras.reduce((a, c) => a + c.costo * c.cantidad, 0));
  const totalMejoras = round2(mejoras.reduce((a, m) => a + m.costo, 0));
  const recibidas = {
    gastos: totalGastos,
    mantenimiento: totalMant,
    compras: totalCompras,
    mejoras: totalMejoras,
    total: round2(totalGastos + totalMant + totalCompras + totalMejoras),
  };

  const netoGlobal = round2(emitidas.ingresoTotal - recibidas.total);

  // ---------- Neto por HABITACIÓN ----------
  // Ingreso: suma de líneas de detalle atribuidas a cada habitación.
  // Egreso: mantenimiento + mejoras cuya área corresponde a esa habitación.
  const areaDeHab = (n: number) => `HAB_${n}`;
  const porHabitacion = habitaciones.map((h) => {
    let ingreso = 0;
    for (const f of facturas) {
      for (const d of f.detalles) {
        if (d.habitacion?.numero === h.numero) ingreso += d.precioTotalSinImpuesto;
      }
    }
    const egresoMant = mantenimientos.filter((m) => m.area === areaDeHab(h.numero)).reduce((a, m) => a + m.costoTotal, 0);
    const egresoMej = mejoras.filter((m) => m.area === areaDeHab(h.numero)).reduce((a, m) => a + m.costo, 0);
    const egreso = round2(egresoMant + egresoMej);
    return {
      numero: h.numero,
      nombre: h.nombre,
      ingreso: round2(ingreso),
      egreso,
      neto: round2(ingreso - egreso),
    };
  });

  return NextResponse.json({ anio, emitidas, recibidas, netoGlobal, porHabitacion });
}
