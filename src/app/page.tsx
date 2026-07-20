import { prisma } from '@/lib/db';
import { fmtUsd } from '@/lib/money';
import { getSesion } from '@/lib/auth/servidor';
import { SelectorHabitaciones } from '@/components/SelectorHabitaciones';
import { AvisoObligaciones } from '@/components/AvisoObligaciones';
import { SaludoHora } from '@/components/SaludoHora';

export const dynamic = 'force-dynamic';

/**
 * DASHBOARD PRINCIPAL — grid visual de habitaciones.
 * Tocar una habitación inicia la facturación de ese espacio.
 * 2 columnas en móviles grandes (iPhone 14 Pro Max / Note 10 Lite),
 * 3 columnas en escritorio.
 */
export default async function Dashboard() {
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [habitaciones, ventasMes, gastosMes] = await Promise.all([
    prisma.habitacion.findMany({ where: { activa: true }, orderBy: { numero: 'asc' } }),
    prisma.factura.aggregate({
      where: { fechaEmision: { gte: inicioMes }, anulada: false },
      _sum: { importeTotal: true },
      _count: true,
    }),
    prisma.gasto.aggregate({ where: { fecha: { gte: inicioMes } }, _sum: { total: true } }),
  ]);

  const ingresos = ventasMes._sum.importeTotal ?? 0;
  const gastos = gastosMes._sum.total ?? 0;
  // Los montos del mes son CONFIDENCIALES: solo los ve el ADMINISTRADOR.
  // Los demás roles ven el grid de habitaciones y facturan con normalidad.
  const esAdmin = (await getSesion())?.rol === 'ADMIN';

  return (
    <div className="space-y-6">
      <header>
        <SaludoHora />
        <p className="mt-2 text-sm text-slate-500">
          Toca las habitaciones que quieres facturar (puedes elegir varias)
        </p>
      </header>

      {/* ---------- Resumen del mes (SOLO ADMIN) ---------- */}
      {esAdmin && (
        <section className="grid grid-cols-3 gap-3">
          <div className="tarjeta p-4">
            <p className="text-xs text-slate-500">Ingresos del mes</p>
            <p className="mt-1 text-lg font-bold text-brand-700 xs:text-xl">{fmtUsd(ingresos)}</p>
          </div>
          <div className="tarjeta p-4">
            <p className="text-xs text-slate-500">Gastos del mes</p>
            <p className="mt-1 text-lg font-bold text-coral-600 xs:text-xl">{fmtUsd(gastos)}</p>
          </div>
          <div className="tarjeta p-4">
            <p className="text-xs text-slate-500">Facturas</p>
            <p className="mt-1 text-lg font-bold xs:text-xl">{ventasMes._count}</p>
          </div>
        </section>
      )}

      {/* ---------- Avisos de obligaciones tributarias (cuenta regresiva) ---------- */}
      <AvisoObligaciones />

      {/* ---------- Selector multi-habitación (facturar desde el inicio) ---------- */}
      <SelectorHabitaciones habitaciones={JSON.parse(JSON.stringify(habitaciones))} />
    </div>
  );
}
