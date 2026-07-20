'use client';

/**
 * PANEL BI/CRM (oculto) — dos vistas:
 *  · Analítica: distribuciones demográficas cruzadas con ingresos/noches.
 *  · Registrar: formulario para capturar la demografía de una factura.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { fmtUsd } from '@/lib/money';
import { GENEROS, ESTADOS_RELACION, SEGMENTOS_VIAJERO } from '@/lib/bi/catalogos';

const COLORES = ['#0d9488', '#1e3a8a', '#f59e0b', '#f43f5e', '#8b5cf6', '#10b981', '#64748b'];

interface Grupo {
  clave: string;
  etiqueta: string;
  perfiles: number;
  ingresos: number;
  noches: number;
}
interface Analitica {
  anio: number;
  resumen: { perfilesRegistrados: number; totalFacturas: number; cobertura: number; ingresosConPerfil: number };
  porGenero: Grupo[];
  porEdad: Grupo[];
  porSegmento: Grupo[];
  porNacionalidad: Grupo[];
  porRelacion: Grupo[];
}
interface FacturaBI {
  id: string;
  numeroCompleto: string;
  fecha: string;
  cliente: string;
  huespedes: number;
  noches: number;
  total: number;
  tienePerfil: boolean;
}

export function PanelBI() {
  const [tab, setTab] = useState<'insights' | 'analitica' | 'registrar'>('insights');

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔎</span>
          <h1 className="text-2xl font-bold">Inteligencia de negocio</h1>
        </div>
        <p className="text-sm text-slate-500">
          Datos demográficos internos (no visibles para el huésped) cruzados con ingresos.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
        {(
          [
            ['insights', 'Insights'],
            ['analitica', 'Analítica'],
            ['registrar', 'Registrar datos'],
          ] as const
        ).map(([v, t]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === v ? 'bg-white text-brand-700 shadow' : 'text-slate-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'insights' ? <Insights /> : tab === 'analitica' ? <Analitica /> : <Registrar />}
    </div>
  );
}

// ============================ INSIGHTS (estilo Airbnb Host) ============================
interface InsightsData {
  anio: number;
  resumen: {
    ingresoTotalAnio: number;
    reservasAnio: number;
    avgEstadiaNoches: number;
    ocupacionPromedioPct: number;
    habitacionesActivas: number;
  };
  ingresosPorHabitacion: { numero: number; nombre: string; ingresos: number; nochesVendidas: number; reservas: number }[];
  tendenciaMensual: {
    mes: string;
    ingresos: number;
    ocupacionPct: number;
    ingresosAnioAnterior: number;
    ocupacionAnioAnteriorPct: number;
  }[];
}

function Insights() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [datos, setDatos] = useState<InsightsData | null>(null);

  useEffect(() => {
    setDatos(null);
    void fetch(`/api/bi/insights?anio=${anio}`)
      .then((r) => r.json())
      .then(setDatos);
  }, [anio]);

  if (!datos) return <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>;
  const { resumen } = datos;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setAnio(anio - 1)} className="btn-secundario px-3">←</button>
          <span className="flex items-center px-2 font-semibold">{anio}</span>
          <button
            onClick={() => setAnio(anio + 1)}
            className="btn-secundario px-3"
            disabled={anio >= new Date().getFullYear()}
          >
            →
          </button>
        </div>
      </div>

      {/* KPIs estilo "Earnings summary" */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Ingresos del año', fmtUsd(resumen.ingresoTotalAnio)],
          ['Reservas', String(resumen.reservasAnio)],
          ['Estadía promedio', `${resumen.avgEstadiaNoches} noche(s)`],
          ['Ocupación promedio', `${resumen.ocupacionPromedioPct}%`],
        ].map(([t, v]) => (
          <div key={t} className="tarjeta p-4">
            <p className="text-xs text-slate-500">{t}</p>
            <p className="mt-1 text-lg font-bold text-brand-700 xs:text-xl">{v}</p>
          </div>
        ))}
      </section>

      {/* Ingresos por habitación */}
      <section className="tarjeta p-4">
        <h2 className="mb-3 font-semibold">Ingresos por habitación</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos.ingresosPorHabitacion} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="nombre" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: number | string) => fmtUsd(Number(v))} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#0d9488" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Tendencia de ingresos: año actual vs. año anterior (YoY) */}
      <section className="tarjeta p-4">
        <h2 className="mb-3 font-semibold">Tendencia de ingresos ({anio} vs. {anio - 1})</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos.tendenciaMensual} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: number | string) => fmtUsd(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="ingresos" name={String(anio)} stroke="#0d9488" strokeWidth={2} dot={false} />
              <Line
                type="monotone"
                dataKey="ingresosAnioAnterior"
                name={String(anio - 1)}
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Tendencia de ocupación: año actual vs. año anterior (YoY) */}
      <section className="tarjeta p-4">
        <h2 className="mb-1 font-semibold">Ocupación mensual ({anio} vs. {anio - 1})</h2>
        <p className="mb-3 text-xs text-slate-400">
          Estimación: noches vendidas ÷ (habitaciones activas × días del mes). No descuenta bloqueos manuales.
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos.tendenciaMensual} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" fontSize={11} />
              <YAxis fontSize={11} unit="%" />
              <Tooltip formatter={(v: number | string) => `${v}%`} />
              <Legend />
              <Line type="monotone" dataKey="ocupacionPct" name={String(anio)} stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line
                type="monotone"
                dataKey="ocupacionAnioAnteriorPct"
                name={String(anio - 1)}
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Detalle por habitación */}
      <section className="tarjeta p-4">
        <h2 className="mb-3 font-semibold">Detalle por habitación</h2>
        <ul className="space-y-2 text-sm">
          {datos.ingresosPorHabitacion.map((h) => (
            <li key={h.numero} className="flex items-center justify-between border-b border-slate-50 py-1">
              <span>{h.nombre} <span className="text-xs text-slate-400">({h.reservas} reserva(s), {h.nochesVendidas} noche(s))</span></span>
              <span className="font-semibold text-brand-700">{fmtUsd(h.ingresos)}</span>
            </li>
          ))}
          {datos.ingresosPorHabitacion.length === 0 && <p className="text-slate-400">Sin datos.</p>}
        </ul>
      </section>
    </div>
  );
}

// ============================ ANALÍTICA ============================
function Analitica() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [datos, setDatos] = useState<Analitica | null>(null);

  useEffect(() => {
    setDatos(null);
    void fetch(`/api/bi/analitica?anio=${anio}`)
      .then((r) => r.json())
      .then(setDatos);
  }, [anio]);

  if (!datos) return <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>;
  const { resumen } = datos;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setAnio(anio - 1)} className="btn-secundario px-3">←</button>
          <span className="flex items-center px-2 font-semibold">{anio}</span>
          <button
            onClick={() => setAnio(anio + 1)}
            className="btn-secundario px-3"
            disabled={anio >= new Date().getFullYear()}
          >
            →
          </button>
        </div>
      </div>

      {/* Cobertura */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Perfiles registrados', String(resumen.perfilesRegistrados)],
          ['Facturas del año', String(resumen.totalFacturas)],
          ['Cobertura', `${resumen.cobertura}%`],
          ['Ingresos con perfil', fmtUsd(resumen.ingresosConPerfil)],
        ].map(([t, v]) => (
          <div key={t} className="tarjeta p-4">
            <p className="text-xs text-slate-500">{t}</p>
            <p className="mt-1 text-lg font-bold text-brand-700 xs:text-xl">{v}</p>
          </div>
        ))}
      </section>

      {resumen.perfilesRegistrados === 0 ? (
        <p className="tarjeta p-6 text-center text-sm text-slate-400">
          Aún no hay perfiles demográficos este año. Ve a “Registrar datos” para empezar.
        </p>
      ) : (
        <>
          <GraficoBarras titulo="Ingresos por segmento de viajero" grupos={datos.porSegmento} />
          <div className="grid gap-5 md:grid-cols-2">
            <GraficoTorta titulo="Distribución por género" grupos={datos.porGenero} />
            <GraficoBarras titulo="Ingresos por rango de edad" grupos={datos.porEdad} />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <GraficoTorta titulo="Estado de relación" grupos={datos.porRelacion} />
            <TablaGrupo titulo="Nacionalidades" grupos={datos.porNacionalidad} />
          </div>
        </>
      )}
    </div>
  );
}

function GraficoBarras({ titulo, grupos }: { titulo: string; grupos: Grupo[] }) {
  return (
    <section className="tarjeta p-4">
      <h2 className="mb-3 font-semibold">{titulo}</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={grupos} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="etiqueta" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v: number | string) => fmtUsd(Number(v))} />
            <Bar dataKey="ingresos" name="Ingresos" fill="#0d9488" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function GraficoTorta({ titulo, grupos }: { titulo: string; grupos: Grupo[] }) {
  return (
    <section className="tarjeta p-4">
      <h2 className="mb-3 font-semibold">{titulo}</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={grupos} dataKey="perfiles" nameKey="etiqueta" cx="50%" cy="50%" outerRadius={80} label>
              {grupos.map((_, i) => (
                <Cell key={i} fill={COLORES[i % COLORES.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number | string, n) => [`${v} huésped(es)`, n as string]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function TablaGrupo({ titulo, grupos }: { titulo: string; grupos: Grupo[] }) {
  return (
    <section className="tarjeta p-4">
      <h2 className="mb-3 font-semibold">{titulo}</h2>
      <ul className="space-y-2 text-sm">
        {grupos.map((g) => (
          <li key={g.clave} className="flex items-center justify-between">
            <span>{g.etiqueta} <span className="text-xs text-slate-400">({g.perfiles})</span></span>
            <span className="font-semibold text-brand-700">{fmtUsd(g.ingresos)}</span>
          </li>
        ))}
        {grupos.length === 0 && <p className="text-slate-400">Sin datos.</p>}
      </ul>
    </section>
  );
}

// ============================ REGISTRAR ============================
const CAMPO_VACIO = {
  genero: '',
  edad: '',
  nacionalidad: '',
  paisResidencia: '',
  profesion: '',
  estadoRelacion: '',
  segmentoViajero: '',
  notas: '',
};

function Registrar() {
  const [facturas, setFacturas] = useState<FacturaBI[]>([]);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [seleccion, setSeleccion] = useState<FacturaBI | null>(null);
  const [form, setForm] = useState({ ...CAMPO_VACIO });
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargarLista = useCallback(() => {
    void fetch(`/api/bi/facturas${soloPendientes ? '?pendientes=1' : ''}`)
      .then((r) => r.json())
      .then(setFacturas);
  }, [soloPendientes]);

  useEffect(() => cargarLista(), [cargarLista]);

  const elegir = async (f: FacturaBI) => {
    setSeleccion(f);
    setGuardado(false);
    setError('');
    setForm({ ...CAMPO_VACIO });
    // Si ya tiene perfil, precargarlo para editar.
    if (f.tienePerfil) {
      const p = await fetch(`/api/bi/perfil?facturaId=${f.id}`).then((r) => r.json());
      if (p) {
        setForm({
          genero: p.genero ?? '',
          edad: p.edad != null ? String(p.edad) : '',
          nacionalidad: p.nacionalidad ?? '',
          paisResidencia: p.paisResidencia ?? '',
          profesion: p.profesion ?? '',
          estadoRelacion: p.estadoRelacion ?? '',
          segmentoViajero: p.segmentoViajero ?? '',
          notas: p.notas ?? '',
        });
      }
    }
  };

  const guardar = async () => {
    if (!seleccion) return;
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/bi/perfil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facturaId: seleccion.id, ...form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');
      setGuardado(true);
      cargarLista();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const listaFiltrada = useMemo(() => facturas, [facturas]);

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
      {/* Lista de facturas */}
      <section className="tarjeta p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Facturas</h2>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={soloPendientes}
              onChange={(e) => setSoloPendientes(e.target.checked)}
            />
            Solo sin perfil
          </label>
        </div>
        <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
          {listaFiltrada.map((f) => (
            <li key={f.id}>
              <button
                onClick={() => elegir(f)}
                className={`w-full rounded-lg border p-2 text-left text-sm transition ${
                  seleccion?.id === f.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="flex justify-between">
                  <span className="font-medium">{f.numeroCompleto}</span>
                  <span>{f.tienePerfil ? '✅' : '○'}</span>
                </span>
                <span className="block text-xs text-slate-500">
                  {f.cliente} · {f.huespedes}p · {fmtUsd(f.total)}
                </span>
              </button>
            </li>
          ))}
          {listaFiltrada.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">No hay facturas aquí.</p>
          )}
        </ul>
      </section>

      {/* Formulario demográfico */}
      <section className="tarjeta p-4">
        {!seleccion ? (
          <p className="py-10 text-center text-sm text-slate-400">
            Selecciona una factura para registrar los datos del huésped.
          </p>
        ) : (
          <>
            <h2 className="font-semibold">Perfil · {seleccion.numeroCompleto}</h2>
            <p className="mb-4 text-xs text-slate-500">{seleccion.cliente}</p>

            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Género">
                <select className="campo" value={form.genero} onChange={set('genero')}>
                  <option value="">—</option>
                  {GENEROS.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Edad">
                <input type="number" min={0} max={120} className="campo" value={form.edad} onChange={set('edad')} />
              </Campo>
              <Campo etiqueta="Nacionalidad">
                <input className="campo" placeholder="Ej.: Ecuatoriana" value={form.nacionalidad} onChange={set('nacionalidad')} />
              </Campo>
              <Campo etiqueta="País de residencia">
                <input className="campo" value={form.paisResidencia} onChange={set('paisResidencia')} />
              </Campo>
              <Campo etiqueta="Profesión">
                <input className="campo" value={form.profesion} onChange={set('profesion')} />
              </Campo>
              <Campo etiqueta="Estado de relación">
                <select className="campo" value={form.estadoRelacion} onChange={set('estadoRelacion')}>
                  <option value="">—</option>
                  {ESTADOS_RELACION.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                </select>
              </Campo>
            </div>

            <div className="mt-3">
              <Campo etiqueta="Segmento de viajero">
                <select className="campo" value={form.segmentoViajero} onChange={set('segmentoViajero')}>
                  <option value="">—</option>
                  {SEGMENTOS_VIAJERO.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                </select>
              </Campo>
            </div>
            <div className="mt-3">
              <Campo etiqueta="Notas">
                <textarea className="campo min-h-[64px]" value={form.notas} onChange={set('notas')} />
              </Campo>
            </div>

            {error && <p className="mt-3 rounded-lg bg-coral-50 p-2 text-sm text-coral-600">{error}</p>}
            {guardado && <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">✅ Perfil guardado.</p>}

            <button onClick={guardar} disabled={guardando} className="btn-primario mt-4 w-full">
              {guardando ? 'Guardando…' : 'Guardar perfil'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="etiqueta">{etiqueta}</span>
      {children}
    </div>
  );
}
