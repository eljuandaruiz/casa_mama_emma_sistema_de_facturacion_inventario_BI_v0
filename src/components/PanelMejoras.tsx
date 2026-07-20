'use client';

/**
 * Módulo de MEJORAS (upgrades de capital), separado de mantenimiento. Permite:
 *  - Registrar una mejora por habitación (descripción, costo, factura, foto).
 *  - Ver un TIMELINE cronológico de las mejoras de una habitación elegida.
 *  - Ver una tabla RESUMEN del capital invertido por habitación.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { comprimirImagen } from '@/lib/imagen';
import { AREAS, etiquetaArea } from '@/lib/areas';
import { fmtUsd } from '@/lib/money';

interface Mejora {
  id: number;
  area: string;
  areaEtiqueta: string;
  descripcion: string;
  costo: number;
  numeroFactura: string | null;
  imagen: string | null;
  fecha: string;
}
interface ResumenArea {
  area: string;
  areaEtiqueta: string;
  total: number;
  n: number;
}

const FORM_VACIO = {
  area: 'HAB_2',
  descripcion: '',
  costo: '',
  numeroFactura: '',
  fecha: new Date().toISOString().slice(0, 10),
};

export function PanelMejoras() {
  const [mejoras, setMejoras] = useState<Mejora[]>([]);
  const [resumen, setResumen] = useState<ResumenArea[]>([]);
  const [totalGlobal, setTotalGlobal] = useState(0);
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [imagen, setImagen] = useState('');
  const [alta, setAlta] = useState(false);
  const [error, setError] = useState('');
  // Habitación seleccionada para el timeline (por defecto, todas).
  const [areaTimeline, setAreaTimeline] = useState<string>('TODAS');

  const cargar = useCallback(() => {
    void fetch('/api/mejoras')
      .then((r) => r.json())
      .then((d) => {
        setMejoras(d.mejoras);
        setResumen(d.resumen);
        setTotalGlobal(d.totalGlobal);
      });
  }, []);
  useEffect(() => cargar(), [cargar]);

  const crear = async () => {
    setError('');
    if (!form.descripcion.trim() || !form.costo) return setError('Completa descripción y costo.');
    const res = await fetch('/api/mejoras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, imagen: imagen || undefined }),
    });
    if (res.ok) {
      setForm({ ...FORM_VACIO });
      setImagen('');
      setAlta(false);
      cargar();
    } else setError('No se pudo registrar la mejora.');
  };

  // Timeline: mejoras de la habitación elegida, agrupadas por mes.
  const timeline = useMemo(() => {
    const filtradas = areaTimeline === 'TODAS' ? mejoras : mejoras.filter((m) => m.area === areaTimeline);
    const porMes = new Map<string, Mejora[]>();
    for (const m of filtradas) {
      const d = new Date(m.fecha);
      const clave = d.toLocaleDateString('es-EC', { year: 'numeric', month: 'long' });
      const arr = porMes.get(clave) ?? [];
      arr.push(m);
      porMes.set(clave, arr);
    }
    return [...porMes.entries()];
  }, [mejoras, areaTimeline]);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mejoras y upgrades</h1>
          <p className="text-sm text-slate-500">Inversiones de capital por habitación (línea de tiempo)</p>
        </div>
        <button onClick={() => setAlta((v) => !v)} className="btn-primario text-sm">
          {alta ? 'Cerrar' : '+ Mejora'}
        </button>
      </header>

      {/* Capital total invertido */}
      <div className="tarjeta border-l-4 border-brand-500 p-4">
        <p className="text-xs text-slate-500">Capital total invertido en mejoras</p>
        <p className="mt-1 text-2xl font-bold text-brand-700">{fmtUsd(totalGlobal)}</p>
      </div>

      {alta && (
        <section className="tarjeta space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="etiqueta">Habitación / área</label>
              <select className="campo" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
                {AREAS.map((a) => <option key={a.valor} value={a.valor}>{a.etiqueta}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta">Fecha</label>
              <input type="date" className="campo" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="etiqueta">Descripción de la mejora</label>
              <input className="campo" placeholder="Ej.: Interruptores inteligentes + TV nueva" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Costo (USD)</label>
              <input type="number" step="0.01" className="campo" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Nº de factura (opcional)</label>
              <input className="campo" value={form.numeroFactura} onChange={(e) => setForm({ ...form, numeroFactura: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="etiqueta">Foto (opcional)</label>
              <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImagen(await comprimirImagen(f, 1000, 0.7)); }} />
              {imagen && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={imagen} alt="Previsualización" className="mt-2 h-24 rounded-lg object-cover" />
              )}
            </div>
          </div>
          {error && <p className="text-sm text-coral-600">{error}</p>}
          <button onClick={crear} className="btn-primario w-full">Guardar mejora</button>
        </section>
      )}

      {/* Tabla resumen por habitación */}
      <section className="tarjeta overflow-x-auto p-4">
        <h2 className="mb-3 font-semibold">Capital invertido por habitación</h2>
        <table className="w-full min-w-[360px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2">Habitación / área</th>
              <th className="text-right"># Mejoras</th>
              <th className="text-right">Capital</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((r) => (
              <tr key={r.area} className="border-b border-slate-50">
                <td className="py-2">{r.areaEtiqueta}</td>
                <td className="text-right">{r.n}</td>
                <td className="text-right font-semibold text-brand-700">{fmtUsd(r.total)}</td>
              </tr>
            ))}
            {resumen.length === 0 && (
              <tr><td colSpan={3} className="py-6 text-center text-slate-400">Sin mejoras registradas.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Timeline cronológico por habitación */}
      <section className="tarjeta p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Línea de tiempo</h2>
          <select className="campo max-w-[220px] py-1.5 text-sm" value={areaTimeline} onChange={(e) => setAreaTimeline(e.target.value)}>
            <option value="TODAS">Todas las habitaciones</option>
            {AREAS.map((a) => <option key={a.valor} value={a.valor}>{a.etiqueta}</option>)}
          </select>
        </div>
        {timeline.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Sin mejoras para mostrar.</p>
        ) : (
          <div className="space-y-4">
            {timeline.map(([mes, items]) => (
              <div key={mes}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{mes}</p>
                <ul className="space-y-2 border-l-2 border-brand-200 pl-4">
                  {items.map((m) => (
                    <li key={m.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-3 w-3 rounded-full bg-brand-500" />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{m.descripcion}</p>
                          <p className="text-xs text-slate-500">
                            {m.areaEtiqueta} · {new Date(m.fecha).toLocaleDateString('es-EC')}
                            {m.numeroFactura ? ` · Fact. ${m.numeroFactura}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-brand-700">{fmtUsd(m.costo)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
