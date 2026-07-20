'use client';

/**
 * Dashboard financiero maestro: ingresos vs egresos (gastos, mantenimiento,
 * compras) y proyección de impuestos (IVA a pagar, base de renta, renta
 * estimada). Datos de /api/finanzas.
 */
import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { fmtUsd } from '@/lib/money';

interface Finanzas {
  anio: number;
  ingresos: { base: number; iva: number; total: number; nFacturas: number };
  egresos: { gastos: number; mantenimiento: number; compras: number; total: number };
  utilidad: number;
  impuestos: { ivaCobrado: number; ivaGastos: number; ivaAPagar: number; baseRenta: number; rentaProyectada: number };
}

interface Rentabilidad {
  mes: string;
  totalFijo: number;
  costoFijoPorFactura: number;
  utilidadTotal: number;
  detalle: {
    numeroCompleto: string;
    cliente: string;
    ingresoNeto: number;
    costoConsumibles: number;
    costoFijoProrrateado: number;
    utilidadBruta: number;
    margenPct: number;
  }[];
}

interface Reconciliacion {
  emitidas: { autorizadas: number; total: number; ingresoAutorizado: number; ingresoTotal: number };
  recibidas: { gastos: number; mantenimiento: number; compras: number; mejoras: number; total: number };
  netoGlobal: number;
  porHabitacion: { numero: number; nombre: string; ingreso: number; egreso: number; neto: number }[];
}

interface Rango {
  desde: string;
  hasta: string;
  ingresos: number;
  ingresosFacturados: number;
  ingresosRimpe: number;
  egresos: number;
  utilidad: number;
  nFacturas: number;
  costoAmenities: number;
  ultimos30dias: number;
  promedioMensualAnio: number;
  totalAnio: number;
}

const hoyIso = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export function PanelFinanzas() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [d, setD] = useState<Finanzas | null>(null);
  const [rent, setRent] = useState<Rentabilidad | null>(null);
  const [recon, setRecon] = useState<Reconciliacion | null>(null);

  // ---------- Período acotado (semana / mes / año / personalizado) ----------
  const [desde, setDesde] = useState(() => {
    const d0 = new Date();
    d0.setDate(1);
    return d0.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(hoyIso());
  const [rango, setRango] = useState<Rango | null>(null);

  useEffect(() => {
    void fetch(`/api/finanzas/rango?desde=${desde}&hasta=${hasta}`)
      .then((r) => r.json())
      .then((j) => { if (!j.error) setRango(j); });
  }, [desde, hasta]);

  const presetPeriodo = (p: 'SEMANA' | 'MES' | 'ANIO') => {
    if (p === 'SEMANA') setDesde(diasAtras(7));
    if (p === 'MES') {
      const d0 = new Date();
      d0.setDate(1);
      setDesde(d0.toISOString().slice(0, 10));
    }
    if (p === 'ANIO') setDesde(`${new Date().getFullYear()}-01-01`);
    setHasta(hoyIso());
  };

  useEffect(() => {
    setD(null);
    void fetch(`/api/finanzas?anio=${anio}`).then((r) => r.json()).then(setD);
    void fetch(`/api/finanzas/reconciliacion?anio=${anio}`).then((r) => r.json()).then(setRecon);
  }, [anio]);

  // Rentabilidad por factura del mes en curso (unit economics).
  useEffect(() => {
    const mes = new Date().toISOString().slice(0, 7);
    void fetch(`/api/finanzas/rentabilidad?mes=${mes}`).then((r) => r.json()).then(setRent);
  }, []);

  if (!d) return <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>;

  const chart = [
    { nombre: 'Ingresos', valor: d.ingresos.base },
    { nombre: 'Egresos', valor: d.egresos.total },
    { nombre: 'Utilidad', valor: d.utilidad },
  ];

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Finanzas {anio}</h1>
          <p className="text-sm text-slate-500">Resumen maestro y proyección de impuestos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAnio(anio - 1)} className="btn-secundario px-3">←</button>
          <button onClick={() => setAnio(anio + 1)} className="btn-secundario px-3" disabled={anio >= new Date().getFullYear()}>→</button>
        </div>
      </header>

      {/* ---------- Período acotado: semana / mes / año / personalizado ---------- */}
      <section className="tarjeta space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Período:</span>
          {(
            [
              ['SEMANA', 'Últimos 7 días'],
              ['MES', 'Este mes'],
              ['ANIO', 'Este año'],
            ] as const
          ).map(([v, t]) => (
            <button key={v} onClick={() => presetPeriodo(v)} className="btn-secundario px-3 py-1.5 text-xs">
              {t}
            </button>
          ))}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <input type="date" className="campo max-w-[150px] py-1.5" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
            →
            <input type="date" className="campo max-w-[150px] py-1.5" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
          </div>
        </div>

        {rango && (
          <>
            {/* KPIs de ALTO CONTRASTE (estilo Power BI / Airbnb sobre fondo
                oscuro): INGRESOS en verde brillante; EGRESOS en rojo con filo
                blanco para máxima legibilidad; utilidad en verde/rojo según signo. */}
            <div className="grid grid-cols-1 gap-3 xs:grid-cols-3">
              <div className="rounded-2xl p-4" style={{ backgroundColor: '#0a0a0a' }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Ingresos</p>
                <p
                  className="mt-1 text-2xl font-black"
                  style={{ color: '#22c55e', textShadow: '0 0 2px #fff, 0 0 6px rgba(255,255,255,.35)' }}
                >
                  {fmtUsd(rango.ingresos)}
                </p>
                <p className="text-[11px] text-slate-400">
                  {rango.nFacturas} factura(s){rango.ingresosRimpe > 0 ? ` · ${fmtUsd(rango.ingresosRimpe)} sin factura (RIMPE)` : ''}
                </p>
              </div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: '#0a0a0a' }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Egresos</p>
                <p
                  className="mt-1 text-2xl font-black"
                  style={{ color: '#ef4444', textShadow: '0 0 2px #fff, 0 0 6px rgba(255,255,255,.55)' }}
                >
                  {fmtUsd(rango.egresos)}
                </p>
                <p className="text-[11px] text-slate-400">
                  incluye amenities {fmtUsd(rango.costoAmenities)}
                </p>
              </div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: '#0a0a0a' }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Utilidad</p>
                <p
                  className="mt-1 text-2xl font-black"
                  style={{
                    color: rango.utilidad >= 0 ? '#22c55e' : '#ef4444',
                    textShadow: '0 0 2px #fff, 0 0 6px rgba(255,255,255,.35)',
                  }}
                >
                  {fmtUsd(rango.utilidad)}
                </p>
                <p className="text-[11px] text-slate-400">{rango.desde} → {rango.hasta}</p>
              </div>
            </div>

            {/* KPIs de contexto: promedio mensual, últimos 30 días, total del año. */}
            <div className="grid grid-cols-3 gap-3">
              <div className="tarjeta p-3">
                <p className="text-[11px] text-slate-500">Promedio de ingreso / mes ({new Date().getFullYear()})</p>
                <p className="text-lg font-bold text-brand-700">{fmtUsd(rango.promedioMensualAnio)}</p>
              </div>
              <div className="tarjeta p-3">
                <p className="text-[11px] text-slate-500">Ingresos últimos 30 días</p>
                <p className="text-lg font-bold text-brand-700">{fmtUsd(rango.ultimos30dias)}</p>
              </div>
              <div className="tarjeta p-3">
                <p className="text-[11px] text-slate-500">Total del año</p>
                <p className="text-lg font-bold text-brand-700">{fmtUsd(rango.totalAnio)}</p>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Ingresos vs Egresos */}
      <section className="tarjeta p-4">
        <h2 className="mb-3 font-semibold">Ingresos vs. Egresos</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="nombre" fontSize={12} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: number | string) => fmtUsd(Number(v))} />
              <Bar dataKey="valor" fill="#0d9488" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Desglose de egresos */}
      <section className="tarjeta p-4">
        <h2 className="mb-3 font-semibold">Desglose de egresos</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span>Gastos operativos</span><span className="font-medium">{fmtUsd(d.egresos.gastos)}</span></li>
          <li className="flex justify-between"><span>Mantenimiento</span><span className="font-medium">{fmtUsd(d.egresos.mantenimiento)}</span></li>
          <li className="flex justify-between"><span>Compras / activos</span><span className="font-medium">{fmtUsd(d.egresos.compras)}</span></li>
          <li className="flex justify-between border-t border-slate-100 pt-2 font-bold"><span>Total egresos</span><span>{fmtUsd(d.egresos.total)}</span></li>
        </ul>
      </section>

      {/* Proyección de impuestos */}
      <section className="tarjeta p-4">
        <h2 className="mb-1 font-semibold">Proyección de impuestos</h2>
        <p className="mb-3 text-xs text-slate-400">
          Estimación de apoyo, no reemplaza la declaración oficial ante el SRI.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span>IVA cobrado en ventas</span><span>{fmtUsd(d.impuestos.ivaCobrado)}</span></li>
          <li className="flex justify-between"><span>IVA en gastos (crédito tributario)</span><span>−{fmtUsd(d.impuestos.ivaGastos)}</span></li>
          <li className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-coral-600">
            <span>IVA a pagar (aprox.)</span><span>{fmtUsd(d.impuestos.ivaAPagar)}</span>
          </li>
          <li className="mt-3 flex justify-between"><span>Base imponible de Renta</span><span>{fmtUsd(d.impuestos.baseRenta)}</span></li>
          <li className="flex justify-between font-semibold text-coral-600">
            <span>Impuesto a la Renta proyectado</span><span>{fmtUsd(d.impuestos.rentaProyectada)}</span>
          </li>
        </ul>
      </section>

      {/* Rentabilidad por factura (unit economics) del mes en curso */}
      {rent && rent.detalle.length > 0 && (
        <section className="tarjeta overflow-x-auto p-4">
          <h2 className="mb-1 font-semibold">Rentabilidad por estadía ({rent.mes})</h2>
          <p className="mb-3 text-xs text-slate-400">
            Utilidad = ingreso neto − consumibles − costo fijo prorrateado ({fmtUsd(rent.costoFijoPorFactura)}/factura).
          </p>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2">Factura</th>
                <th className="text-right">Ingreso</th>
                <th className="text-right">Consumibles</th>
                <th className="text-right">Fijo</th>
                <th className="text-right">Utilidad</th>
                <th className="text-right">Margen</th>
              </tr>
            </thead>
            <tbody>
              {rent.detalle.map((r) => (
                <tr key={r.numeroCompleto} className="border-b border-slate-50">
                  <td className="py-2">{r.numeroCompleto}</td>
                  <td className="text-right">{fmtUsd(r.ingresoNeto)}</td>
                  <td className="text-right text-coral-600">−{fmtUsd(r.costoConsumibles)}</td>
                  <td className="text-right text-coral-600">−{fmtUsd(r.costoFijoProrrateado)}</td>
                  <td className={`text-right font-semibold ${r.utilidadBruta >= 0 ? 'text-emerald-600' : 'text-coral-600'}`}>
                    {fmtUsd(r.utilidadBruta)}
                  </td>
                  <td className="text-right">{r.margenPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Conciliación: EMITIDAS (ingresos) vs RECIBIDAS (egresos) */}
      {recon && (
        <section className="tarjeta p-4">
          <h2 className="mb-3 font-semibold">Conciliación {anio}: emitidas vs. recibidas</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Emitidas */}
            <div className="rounded-xl border-l-4 border-emerald-400 bg-emerald-50/40 p-3">
              <p className="text-sm font-semibold text-emerald-800">Emitidas (ingresos)</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li className="flex justify-between"><span>Facturas autorizadas</span><span>{recon.emitidas.autorizadas}/{recon.emitidas.total}</span></li>
                <li className="flex justify-between"><span>Ingreso autorizado</span><span>{fmtUsd(recon.emitidas.ingresoAutorizado)}</span></li>
                <li className="flex justify-between font-semibold"><span>Ingreso total</span><span>{fmtUsd(recon.emitidas.ingresoTotal)}</span></li>
              </ul>
            </div>
            {/* Recibidas */}
            <div className="rounded-xl border-l-4 border-coral-400 bg-coral-50/40 p-3">
              <p className="text-sm font-semibold text-coral-700">Recibidas (egresos)</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li className="flex justify-between"><span>Gastos</span><span>{fmtUsd(recon.recibidas.gastos)}</span></li>
                <li className="flex justify-between"><span>Mantenimiento</span><span>{fmtUsd(recon.recibidas.mantenimiento)}</span></li>
                <li className="flex justify-between"><span>Compras</span><span>{fmtUsd(recon.recibidas.compras)}</span></li>
                <li className="flex justify-between"><span>Mejoras</span><span>{fmtUsd(recon.recibidas.mejoras)}</span></li>
                <li className="flex justify-between border-t border-coral-200 pt-1 font-semibold"><span>Total egresos</span><span>{fmtUsd(recon.recibidas.total)}</span></li>
              </ul>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-100 p-3">
            <span className="font-bold">Neto global (ingresos − egresos)</span>
            <span className={`text-xl font-bold ${recon.netoGlobal >= 0 ? 'text-emerald-600' : 'text-coral-600'}`}>{fmtUsd(recon.netoGlobal)}</span>
          </div>

          {/* Neto por habitación */}
          <h3 className="mb-2 mt-4 text-sm font-semibold">Neto por habitación</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2">Habitación</th>
                  <th className="text-right">Ingreso</th>
                  <th className="text-right">Egreso</th>
                  <th className="text-right">Neto</th>
                </tr>
              </thead>
              <tbody>
                {recon.porHabitacion.map((h) => (
                  <tr key={h.numero} className="border-b border-slate-50">
                    <td className="py-2">{h.nombre}</td>
                    <td className="text-right text-emerald-700">{fmtUsd(h.ingreso)}</td>
                    <td className="text-right text-coral-600">{fmtUsd(h.egreso)}</td>
                    <td className={`text-right font-semibold ${h.neto >= 0 ? 'text-emerald-600' : 'text-coral-600'}`}>{fmtUsd(h.neto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
