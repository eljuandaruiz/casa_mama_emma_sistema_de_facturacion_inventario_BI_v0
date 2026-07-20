import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';

export const dynamic = 'force-dynamic';

export interface EstadisticaMes {
  mes: string; // "2026-07"
  etiqueta: string; // "Jul"
  ingresos: number; // ventas sin impuestos (no anuladas)
  gastos: number;
  utilidad: number;
  ivaCobrado: number;
  ivaPagado: number;
  nFacturas: number;
  nochesVendidas: number;
}

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** GET /api/estadisticas?anio=2026 — serie mes a mes + totales + top habitaciones */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const anio = Number(searchParams.get('anio') ?? new Date().getFullYear());
  const desde = new Date(anio, 0, 1);
  const hasta = new Date(anio + 1, 0, 1);

  const [facturas, gastos] = await Promise.all([
    prisma.factura.findMany({
      where: { fechaEmision: { gte: desde, lt: hasta }, anulada: false },
      include: { detalles: { include: { habitacion: true } } },
    }),
    prisma.gasto.findMany({ where: { fecha: { gte: desde, lt: hasta } } }),
  ]);

  const serie: EstadisticaMes[] = Array.from({ length: 12 }, (_, i) => ({
    mes: `${anio}-${String(i + 1).padStart(2, '0')}`,
    etiqueta: MESES_CORTOS[i],
    ingresos: 0,
    gastos: 0,
    utilidad: 0,
    ivaCobrado: 0,
    ivaPagado: 0,
    nFacturas: 0,
    nochesVendidas: 0,
  }));

  const porHabitacion = new Map<string, { nombre: string; ingresos: number; facturas: number }>();

  for (const f of facturas) {
    const m = serie[f.fechaEmision.getMonth()];
    m.ingresos += f.subtotalSinImpuestos;
    m.ivaCobrado += f.valorIva;
    m.nFacturas += 1;
    m.nochesVendidas += f.noches;
    for (const d of f.detalles) {
      if (!d.habitacion) continue;
      const clave = d.habitacion.nombre;
      const h = porHabitacion.get(clave) ?? { nombre: clave, ingresos: 0, facturas: 0 };
      h.ingresos += d.precioTotalSinImpuesto;
      h.facturas += 1;
      porHabitacion.set(clave, h);
    }
  }
  for (const g of gastos) {
    const m = serie[g.fecha.getMonth()];
    m.gastos += g.subtotal;
    m.ivaPagado += g.iva;
  }
  for (const m of serie) {
    m.ingresos = round2(m.ingresos);
    m.gastos = round2(m.gastos);
    m.utilidad = round2(m.ingresos - m.gastos);
    m.ivaCobrado = round2(m.ivaCobrado);
    m.ivaPagado = round2(m.ivaPagado);
  }

  const totales = {
    ingresos: round2(serie.reduce((a, m) => a + m.ingresos, 0)),
    gastos: round2(serie.reduce((a, m) => a + m.gastos, 0)),
    utilidad: round2(serie.reduce((a, m) => a + m.utilidad, 0)),
    ivaCobrado: round2(serie.reduce((a, m) => a + m.ivaCobrado, 0)),
    nFacturas: serie.reduce((a, m) => a + m.nFacturas, 0),
    nochesVendidas: serie.reduce((a, m) => a + m.nochesVendidas, 0),
  };

  const topHabitaciones = [...porHabitacion.values()]
    .map((h) => ({ ...h, ingresos: round2(h.ingresos) }))
    .sort((a, b) => b.ingresos - a.ingresos);

  return NextResponse.json({ anio, serie, totales, topHabitaciones });
}
