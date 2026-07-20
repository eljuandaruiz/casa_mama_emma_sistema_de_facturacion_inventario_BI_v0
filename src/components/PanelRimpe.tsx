'use client';

/**
 * RIMPE — control simple SIN facturación electrónica.
 * Para el régimen RIMPE Emprendedor (hasta $20,000/año): se registran las
 * estadías cobradas sin factura, se cargan los valores mensuales de agua/
 * luz/internet/teléfono (incluye histórico) y se ve cuánto genera y cuesta
 * cada habitación, con la barra del techo anual del régimen.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { fmtUsd } from '@/lib/money';

interface Ingreso {
  id: number;
  fecha: string;
  numeroHabitacion: number | null;
  huespedes: number;
  noches: number;
  monto: number;
  canal: string;
  notas: string | null;
}
interface ResumenHab {
  habitacion: string;
  n: number;
  ingresos: number;
  noches: number;
  huespedes: number;
  promedioPorNoche: number;
  promedioPorEstadia: number;
}
interface DatosRimpe {
  anio: number;
  limiteRimpe: number;
  totalAnual: number;
  totalSimples: number;
  totalFacturado: number;
  pctLimite: number;
  gastosAnio: number;
  utilidadAnio: number;
  porHabitacion: ResumenHab[];
  ingresos: Ingreso[];
}
interface SerieServicios {
  mes: string;
  total: number;
  [tipo: string]: number | string;
}

const TIPOS_SERVICIO = ['AGUA', 'LUZ', 'INTERNET', 'TELEFONO', 'GAS'] as const;
const COLOR_SERVICIO: Record<string, string> = {
  AGUA: '#0ea5e9', LUZ: '#f59e0b', INTERNET: '#8b5cf6', TELEFONO: '#10b981', GAS: '#f43f5e',
};

const hoyIso = () => new Date().toISOString().slice(0, 10);
const mesActual = () => new Date().toISOString().slice(0, 7);

export function PanelRimpe() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [datos, setDatos] = useState<DatosRimpe | null>(null);
  const [serie, setSerie] = useState<SerieServicios[]>([]);
  const [error, setError] = useState('');

  const [formIngreso, setFormIngreso] = useState({
    fecha: hoyIso(), numeroHabitacion: '', huespedes: '2', noches: '1', monto: '', canal: 'DIRECTO', notas: '',
  });
  const [formServicio, setFormServicio] = useState({ mes: mesActual(), tipo: 'AGUA', valor: '' });

  const cargar = useCallback(() => {
    void fetch(`/api/rimpe?anio=${anio}`).then((r) => r.json()).then(setDatos);
    void fetch('/api/rimpe/servicios').then((r) => r.json()).then((j) => setSerie(j.serie ?? []));
  }, [anio]);
  useEffect(() => cargar(), [cargar]);

  const registrarIngreso = async () => {
    setError('');
    if (!formIngreso.monto || Number(formIngreso.monto) <= 0) return setError('Ingresa el monto recibido.');
    const res = await fetch('/api/rimpe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha: formIngreso.fecha,
        numeroHabitacion: formIngreso.numeroHabitacion ? Number(formIngreso.numeroHabitacion) : undefined,
        huespedes: Number(formIngreso.huespedes) || 1,
        noches: Number(formIngreso.noches) || 1,
        monto: Number(formIngreso.monto),
        canal: formIngreso.canal,
        notas: formIngreso.notas.trim() || undefined,
      }),
    });
    if (!res.ok) return setError((await res.json()).error ?? 'No se pudo registrar');
    setFormIngreso({ ...formIngreso, monto: '', notas: '' });
    cargar();
  };

  const guardarServicio = async () => {
    setError('');
    if (!formServicio.valor) return setError('Ingresa el valor del servicio.');
    const res = await fetch('/api/rimpe/servicios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes: formServicio.mes, tipo: formServicio.tipo, valor: Number(formServicio.valor) }),
    });
    if (!res.ok) return setError((await res.json()).error ?? 'No se pudo guardar');
    setFormServicio({ ...formServicio, valor: '' });
    cargar();
  };

  const eliminarIngreso = async (id: number) => {
    if (!confirm('¿Eliminar este ingreso?')) return;
    await fetch(`/api/rimpe?id=${id}`, { method: 'DELETE' });
    cargar();
  };

  if (!datos) return <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Control RIMPE</h1>
          <p className="text-sm text-slate-500">
            Ingresos sin factura + servicios básicos: cuánto genera y cuesta cada habitación.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAnio(anio - 1)} className="btn-secundario px-3">←</button>
          <span className="flex items-center px-1 font-semibold">{anio}</span>
          <button onClick={() => setAnio(anio + 1)} className="btn-secundario px-3" disabled={anio >= new Date().getFullYear()}>→</button>
        </div>
      </header>

      {/* Techo anual RIMPE ($20,000): barra de progreso. */}
      <section className="tarjeta p-4">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-semibold">Techo RIMPE Emprendedor</span>
          <span className="font-bold text-brand-700">{fmtUsd(datos.totalAnual)} / {fmtUsd(datos.limiteRimpe)}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${datos.pctLimite >= 90 ? 'bg-coral-500' : datos.pctLimite >= 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}
            style={{ width: `${datos.pctLimite}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          {datos.pctLimite}% del límite anual · sin factura {fmtUsd(datos.totalSimples)} + facturado {fmtUsd(datos.totalFacturado)} ·
          gastos {fmtUsd(datos.gastosAnio)} · utilidad {fmtUsd(datos.utilidadAnio)}
        </p>
        {datos.pctLimite >= 90 && (
          <p className="mt-2 rounded-lg bg-coral-50 p-2 text-xs font-semibold text-coral-600">
            ⚠️ Estás cerca de los $20,000: al superarlos cambias de régimen y la facturación electrónica pasa a ser obligatoria.
          </p>
        )}
      </section>

      {/* Registrar ingreso sin factura */}
      <section className="tarjeta space-y-3 p-4">
        <h2 className="font-semibold">Registrar ingreso (sin factura)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div>
            <label className="etiqueta">Fecha</label>
            <input type="date" className="campo" value={formIngreso.fecha} onChange={(e) => setFormIngreso({ ...formIngreso, fecha: e.target.value })} />
          </div>
          <div>
            <label className="etiqueta">Habitación</label>
            <select className="campo" value={formIngreso.numeroHabitacion} onChange={(e) => setFormIngreso({ ...formIngreso, numeroHabitacion: e.target.value })}>
              <option value="">Casa completa / otro</option>
              {[2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>Habitación {n}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta">Canal</label>
            <select className="campo" value={formIngreso.canal} onChange={(e) => setFormIngreso({ ...formIngreso, canal: e.target.value })}>
              <option value="DIRECTO">Directo</option>
              <option value="AIRBNB">Airbnb</option>
              <option value="BOOKING">Booking</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div>
            <label className="etiqueta">Huéspedes</label>
            <input type="number" min={1} className="campo" value={formIngreso.huespedes} onChange={(e) => setFormIngreso({ ...formIngreso, huespedes: e.target.value })} />
          </div>
          <div>
            <label className="etiqueta">Noches</label>
            <input type="number" min={1} className="campo" value={formIngreso.noches} onChange={(e) => setFormIngreso({ ...formIngreso, noches: e.target.value })} />
          </div>
          <div>
            <label className="etiqueta">Monto recibido (USD) *</label>
            <input type="number" min={0} step="0.01" inputMode="decimal" className="campo" value={formIngreso.monto} onChange={(e) => setFormIngreso({ ...formIngreso, monto: e.target.value })} />
          </div>
        </div>
        {error && <p className="rounded-lg bg-coral-50 p-2 text-sm text-coral-600">{error}</p>}
        <button onClick={registrarIngreso} className="btn-primario w-full">Registrar ingreso</button>
      </section>

      {/* Resumen por habitación */}
      <section className="tarjeta overflow-x-auto p-4">
        <h2 className="mb-3 font-semibold">Por habitación ({anio})</h2>
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2">Habitación</th>
              <th className="text-right">Estadías</th>
              <th className="text-right">Noches</th>
              <th className="text-right">Ingresos</th>
              <th className="text-right">Prom./noche</th>
              <th className="text-right">Prom./estadía</th>
            </tr>
          </thead>
          <tbody>
            {datos.porHabitacion.map((h) => (
              <tr key={h.habitacion} className="border-b border-slate-50">
                <td className="py-2 font-medium">{h.habitacion}</td>
                <td className="text-right">{h.n}</td>
                <td className="text-right">{h.noches}</td>
                <td className="text-right font-semibold text-brand-700">{fmtUsd(h.ingresos)}</td>
                <td className="text-right">{fmtUsd(h.promedioPorNoche)}</td>
                <td className="text-right">{fmtUsd(h.promedioPorEstadia)}</td>
              </tr>
            ))}
            {datos.porHabitacion.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-slate-400">Sin ingresos registrados en {anio}.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Servicios básicos: carga mensual + evolución histórica */}
      <section className="tarjeta space-y-3 p-4">
        <h2 className="font-semibold">Servicios básicos (histórico mensual)</h2>
        <div className="grid grid-cols-2 gap-2 xs:grid-cols-4">
          <input type="month" className="campo" value={formServicio.mes} onChange={(e) => setFormServicio({ ...formServicio, mes: e.target.value })} />
          <select className="campo" value={formServicio.tipo} onChange={(e) => setFormServicio({ ...formServicio, tipo: e.target.value })}>
            {TIPOS_SERVICIO.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
          </select>
          <input type="number" min={0} step="0.01" inputMode="decimal" className="campo" placeholder="Valor USD" value={formServicio.valor} onChange={(e) => setFormServicio({ ...formServicio, valor: e.target.value })} />
          <button onClick={guardarServicio} className="btn-primario text-sm">Guardar mes</button>
        </div>
        <p className="text-[11px] text-slate-400">
          Puedes cargar meses ANTERIORES para reconstruir el histórico (se sobreescribe si el mes ya existía).
        </p>
        {serie.length > 0 && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" fontSize={10} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: number | string) => fmtUsd(Number(v))} />
                <Legend />
                {TIPOS_SERVICIO.map((t) => (
                  <Line key={t} type="monotone" dataKey={t} name={t.charAt(0) + t.slice(1).toLowerCase()} stroke={COLOR_SERVICIO[t]} strokeWidth={2} dot connectNulls />
                ))}
                <Line type="monotone" dataKey="total" name="Total" stroke="#0f172a" strokeWidth={2.5} strokeDasharray="5 3" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Últimos ingresos registrados */}
      <section className="tarjeta p-4">
        <h2 className="mb-3 font-semibold">Últimos ingresos</h2>
        <ul className="space-y-1 text-sm">
          {datos.ingresos.slice(0, 25).map((i) => (
            <li key={i.id} className="flex items-center justify-between border-b border-slate-50 py-1.5">
              <span>
                {new Date(i.fecha).toLocaleDateString('es-EC')} · {i.numeroHabitacion ? `Hab. ${i.numeroHabitacion}` : 'Casa/otro'} ·
                {' '}{i.huespedes}p × {i.noches}n · {i.canal.toLowerCase()}
                {i.notas ? ` · ${i.notas}` : ''}
              </span>
              <span className="flex items-center gap-2">
                <strong className="text-brand-700">{fmtUsd(i.monto)}</strong>
                <button onClick={() => eliminarIngreso(i.id)} className="text-slate-300 hover:text-coral-600" aria-label="Eliminar">✕</button>
              </span>
            </li>
          ))}
          {datos.ingresos.length === 0 && <p className="py-3 text-slate-400">Aún no hay ingresos registrados.</p>}
        </ul>
      </section>
    </div>
  );
}
