'use client';

/**
 * Dashboard estadístico mes a mes: ingresos vs gastos, IVA,
 * noches vendidas y ranking de habitaciones. Datos de /api/estadisticas.
 */
import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { fmtUsd } from '@/lib/money';

interface EstadisticaMes {
  mes: string;
  etiqueta: string;
  ingresos: number;
  gastos: number;
  utilidad: number;
  ivaCobrado: number;
  ivaPagado: number;
  nFacturas: number;
  nochesVendidas: number;
}

interface Datos {
  anio: number;
  serie: EstadisticaMes[];
  totales: {
    ingresos: number;
    gastos: number;
    utilidad: number;
    ivaCobrado: number;
    nFacturas: number;
    nochesVendidas: number;
  };
  topHabitaciones: { nombre: string; ingresos: number; facturas: number }[];
}

export default function PaginaEstadisticas() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [datos, setDatos] = useState<Datos | null>(null);

  useEffect(() => {
    void fetch(`/api/estadisticas?anio=${anio}`)
      .then((r) => r.json())
      .then(setDatos);
  }, [anio]);

  if (!datos) return <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>;

  const { totales } = datos;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Estadísticas {anio}</h1>
        <div className="flex gap-2">
          <button onClick={() => setAnio(anio - 1)} className="btn-secundario px-3">←</button>
          <button
            onClick={() => setAnio(anio + 1)}
            className="btn-secundario px-3"
            disabled={anio >= new Date().getFullYear()}
          >
            →
          </button>
        </div>
      </header>

      {/* ---------- KPIs ---------- */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Ingresos', fmtUsd(totales.ingresos), 'text-brand-700'],
          ['Gastos', fmtUsd(totales.gastos), 'text-coral-600'],
          ['Utilidad', fmtUsd(totales.utilidad), totales.utilidad >= 0 ? 'text-emerald-600' : 'text-coral-600'],
          ['Noches vendidas', String(totales.nochesVendidas), 'text-slate-800'],
        ].map(([titulo, valor, color]) => (
          <div key={titulo} className="tarjeta p-4">
            <p className="text-xs text-slate-500">{titulo}</p>
            <p className={`mt-1 text-lg font-bold xs:text-xl ${color}`}>{valor}</p>
          </div>
        ))}
      </section>

      {/* ---------- Ingresos vs Gastos mes a mes ---------- */}
      <section className="tarjeta p-4">
        <h2 className="mb-3 font-semibold">Ingresos vs. Gastos (mes a mes)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datos.serie} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="etiqueta" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: number | string) => fmtUsd(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#0d9488" radius={[6, 6, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              <Line dataKey="utilidad" name="Utilidad" stroke="#1e3a8a" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ---------- IVA (para la declaración mensual) ---------- */}
      <section className="tarjeta overflow-x-auto p-4">
        <h2 className="mb-3 font-semibold">IVA mensual (referencia Formulario 104)</h2>
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2">Mes</th>
              <th># Fact.</th>
              <th>IVA cobrado</th>
              <th>IVA pagado</th>
              <th>IVA a pagar (est.)</th>
            </tr>
          </thead>
          <tbody>
            {datos.serie
              .filter((m) => m.nFacturas > 0 || m.gastos > 0)
              .map((m) => (
                <tr key={m.mes} className="border-b border-slate-50">
                  <td className="py-2 font-medium">{m.etiqueta}</td>
                  <td>{m.nFacturas}</td>
                  <td>{fmtUsd(m.ivaCobrado)}</td>
                  <td>{fmtUsd(m.ivaPagado)}</td>
                  <td className="font-semibold">{fmtUsd(Math.max(0, m.ivaCobrado - m.ivaPagado))}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      {/* ---------- Ranking de habitaciones ---------- */}
      <section className="tarjeta p-4">
        <h2 className="mb-3 font-semibold">Habitaciones más rentables</h2>
        <ul className="space-y-2">
          {datos.topHabitaciones.map((h, i) => (
            <li key={h.nombre} className="flex items-center justify-between text-sm">
              <span>
                <span className="mr-2 font-bold text-slate-400">#{i + 1}</span>
                {h.nombre} <span className="text-xs text-slate-400">({h.facturas} facturas)</span>
              </span>
              <span className="font-semibold text-brand-700">{fmtUsd(h.ingresos)}</span>
            </li>
          ))}
          {datos.topHabitaciones.length === 0 && (
            <p className="text-sm text-slate-400">Aún no hay datos este año.</p>
          )}
        </ul>
      </section>

      <a href="/api/exportar?formato=xlsx" className="btn-primario block text-center">
        ⬇️ Exportar libro completo a Excel (.xlsx)
      </a>
    </div>
  );
}
