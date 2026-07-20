import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const diasDelMes = (anio: number, mesIdx: number) => new Date(anio, mesIdx + 1, 0).getDate();

interface FacturaAgregable {
  fechaEmision: Date;
  checkIn: Date | null;
  noches: number;
  subtotalSinImpuestos: number;
  detalles: { habitacionId: number | null; precioTotalSinImpuesto: number; habitacion: { numero: number; nombre: string } | null }[];
}

/** Agrega ingresos y noches vendidas en 12 cubetas mensuales (índice 0=enero). */
function agregarPorMes(facturas: FacturaAgregable[], anio: number) {
  const ingresos = Array(12).fill(0);
  const noches = Array(12).fill(0);
  for (const f of facturas) {
    const fecha = f.checkIn ?? f.fechaEmision;
    if (fecha.getFullYear() !== anio) continue;
    const mesIdx = fecha.getMonth();
    ingresos[mesIdx] += f.subtotalSinImpuestos;
    for (const d of f.detalles) {
      if (d.habitacionId != null) noches[mesIdx] += f.noches;
    }
  }
  return { ingresos, noches };
}

/**
 * GET /api/bi/insights?anio=2026 — dashboard estilo "Airbnb Host Insights":
 * ingresos por habitación, ocupación y tendencia mensual (MoM) con
 * comparación interanual (YoY) contra el mismo mes del año anterior.
 * Solo ADMIN (protegido por middleware vía prefijo /api/bi).
 */
export async function GET(req: Request) {
  const anio = Number(new URL(req.url).searchParams.get('anio') ?? new Date().getFullYear());

  const habitaciones = await prisma.habitacion.findMany({ where: { activa: true }, orderBy: { numero: 'asc' } });

  // Trae facturas del año actual Y del año anterior (para poder comparar YoY mes a mes).
  const desde = new Date(anio - 1, 0, 1);
  const hasta = new Date(anio + 1, 0, 1);
  const facturas = await prisma.factura.findMany({
    where: { fechaEmision: { gte: desde, lt: hasta }, anulada: false },
    select: {
      fechaEmision: true,
      checkIn: true,
      noches: true,
      subtotalSinImpuestos: true,
      detalles: { select: { habitacionId: true, precioTotalSinImpuesto: true, habitacion: { select: { numero: true, nombre: true } } } },
    },
  });

  const facturasAnioActual = facturas.filter((f) => (f.checkIn ?? f.fechaEmision).getFullYear() === anio);

  // ---------- Ingresos por habitación (bar chart) ----------
  const porHabitacionMap = new Map<number, { numero: number; nombre: string; ingresos: number; nochesVendidas: number; reservas: number }>();
  for (const h of habitaciones) {
    porHabitacionMap.set(h.numero, { numero: h.numero, nombre: h.nombre, ingresos: 0, nochesVendidas: 0, reservas: 0 });
  }
  for (const f of facturasAnioActual) {
    for (const d of f.detalles) {
      if (!d.habitacion) continue;
      const g = porHabitacionMap.get(d.habitacion.numero);
      if (!g) continue;
      g.ingresos += d.precioTotalSinImpuesto;
      g.nochesVendidas += f.noches;
      g.reservas += 1;
    }
  }
  const ingresosPorHabitacion = [...porHabitacionMap.values()]
    .map((g) => ({ ...g, ingresos: round2(g.ingresos) }))
    .sort((a, b) => b.ingresos - a.ingresos);

  // ---------- Tendencia mensual (MoM) + comparación YoY ----------
  const { ingresos: ingresosMesActual, noches: nochesMesActual } = agregarPorMes(facturas, anio);
  const { noches: nochesMesAnterior, ingresos: ingresosMesAnterior } = agregarPorMes(facturas, anio - 1);
  const habitacionesActivas = habitaciones.length || 1;

  const tendenciaMensual = MESES.map((etiqueta, i) => {
    const disponibles = habitacionesActivas * diasDelMes(anio, i);
    const disponiblesAnioAnterior = habitacionesActivas * diasDelMes(anio - 1, i);
    return {
      mes: etiqueta,
      ingresos: round2(ingresosMesActual[i]),
      ocupacionPct: disponibles > 0 ? round2((nochesMesActual[i] / disponibles) * 100) : 0,
      ingresosAnioAnterior: round2(ingresosMesAnterior[i]),
      ocupacionAnioAnteriorPct: disponiblesAnioAnterior > 0 ? round2((nochesMesAnterior[i] / disponiblesAnioAnterior) * 100) : 0,
    };
  });

  // ---------- Duración promedio de estadía ----------
  const avgEstadiaNoches =
    facturasAnioActual.length > 0
      ? round2(facturasAnioActual.reduce((a, f) => a + f.noches, 0) / facturasAnioActual.length)
      : 0;

  const ingresoTotalAnio = round2(facturasAnioActual.reduce((a, f) => a + f.subtotalSinImpuestos, 0));
  const ocupacionPromedioAnio =
    tendenciaMensual.reduce((a, m) => a + m.ocupacionPct, 0) / (tendenciaMensual.length || 1);

  return NextResponse.json({
    anio,
    resumen: {
      ingresoTotalAnio,
      reservasAnio: facturasAnioActual.length,
      avgEstadiaNoches,
      ocupacionPromedioPct: round2(ocupacionPromedioAnio),
      habitacionesActivas: habitaciones.length,
    },
    ingresosPorHabitacion,
    tendenciaMensual,
  });
}
