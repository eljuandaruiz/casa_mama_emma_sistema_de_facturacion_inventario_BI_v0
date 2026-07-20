'use client';

/**
 * Solicitudes de reparación/mejora con matriz de Eisenhower. Un empleado
 * reporta un problema (foto + descripción + área + quién lo detectó + fecha
 * límite + prioridad). Las solicitudes con fecha límite se envían a Google
 * Calendar si está conectado. Vista de tablero por cuadrantes.
 */
import { useCallback, useEffect, useState } from 'react';
import { comprimirImagen } from '@/lib/imagen';
import { AREAS, etiquetaArea } from '@/lib/areas';
import { CUADRANTES, cuadranteDe } from '@/lib/eisenhower';

interface Solicitud {
  id: number;
  titulo: string;
  descripcion: string;
  area: string | null;
  imagen: string | null;
  detectadoPor: string | null;
  prioridad: string;
  estado: string;
  fechaLimite: string | null;
  eventoGoogleId: string | null;
}

const FORM_VACIO = {
  titulo: '',
  descripcion: '',
  area: 'GENERAL',
  detectadoPor: '',
  prioridad: 'IMPORTANTE_NO_URGENTE',
  fechaLimite: '',
};

export function PanelReparaciones() {
  const [items, setItems] = useState<Solicitud[]>([]);
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [imagen, setImagen] = useState<string>('');
  const [alta, setAlta] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    void fetch('/api/reparaciones').then((r) => r.json()).then(setItems);
  }, []);
  useEffect(() => cargar(), [cargar]);

  const subirImagen = async (f: File | null) => {
    if (!f) return;
    try {
      setImagen(await comprimirImagen(f, 1000, 0.7));
    } catch {
      setError('No se pudo procesar la imagen.');
    }
  };

  const crear = async () => {
    setError('');
    setMsg('');
    if (!form.titulo.trim() || !form.descripcion.trim()) return setError('Completa título y descripción.');
    setGuardando(true);
    try {
      const res = await fetch('/api/reparaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, imagen: imagen || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo crear');
      setMsg(json.sincronizadoGoogle ? '✅ Creada y agendada en Google Calendar.' : '✅ Solicitud creada.');
      setForm({ ...FORM_VACIO });
      setImagen('');
      setAlta(false);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (id: number, estado: string) => {
    await fetch('/api/reparaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado }),
    });
    cargar();
  };

  const activas = items.filter((s) => s.estado !== 'RESUELTA' && s.estado !== 'DESCARTADA');

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes de reparación</h1>
          <p className="text-sm text-slate-500">Reporta problemas y priorízalos (matriz de Eisenhower)</p>
        </div>
        <button onClick={() => setAlta((v) => !v)} className="btn-primario text-sm">
          {alta ? 'Cerrar' : '+ Nueva solicitud'}
        </button>
      </header>

      {msg && <p className="tarjeta bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}

      {alta && (
        <section className="tarjeta space-y-3 p-4">
          <div>
            <label className="etiqueta">Título *</label>
            <input className="campo" placeholder="Ej.: Fuga de agua en lavamanos" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div>
            <label className="etiqueta">Descripción del problema *</label>
            <textarea className="campo min-h-[70px]" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="etiqueta">Área</label>
              <select className="campo" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
                {AREAS.map((a) => <option key={a.valor} value={a.valor}>{a.etiqueta}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta">Detectado por</label>
              <input className="campo" value={form.detectadoPor} onChange={(e) => setForm({ ...form, detectadoPor: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Prioridad (Eisenhower)</label>
              <select className="campo" value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>
                {CUADRANTES.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta">Fecha límite (se agenda en Google)</label>
              <input type="date" className="campo" value={form.fechaLimite} onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="etiqueta">Foto del problema (opcional)</label>
            <input type="file" accept="image/*" onChange={(e) => subirImagen(e.target.files?.[0] ?? null)} />
            {imagen && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={imagen} alt="Previsualización" className="mt-2 h-24 rounded-lg object-cover" />
            )}
          </div>
          {error && <p className="text-sm text-coral-600">{error}</p>}
          <button onClick={crear} disabled={guardando} className="btn-primario w-full">
            {guardando ? 'Guardando…' : 'Crear solicitud'}
          </button>
        </section>
      )}

      {/* Tablero por cuadrantes de Eisenhower */}
      <div className="grid gap-4 md:grid-cols-2">
        {CUADRANTES.map((c) => {
          const delCuadrante = activas.filter((s) => s.prioridad === c.valor);
          return (
            <section key={c.valor} className="tarjeta p-4" style={{ borderTop: `3px solid ${c.color}` }}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold" style={{ color: c.color }}>{c.etiqueta}</h2>
                <span className="text-[11px] text-slate-400">{c.accion}</span>
              </div>
              <ul className="space-y-2">
                {delCuadrante.map((s) => (
                  <li key={s.id} className="rounded-lg border border-slate-200 p-2 text-sm">
                    <div className="flex items-start gap-2">
                      {s.imagen && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.imagen} alt="" className="h-12 w-16 shrink-0 rounded object-cover" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{s.titulo}</p>
                        <p className="text-xs text-slate-500">
                          {etiquetaArea(s.area)}
                          {s.fechaLimite ? ` · límite ${new Date(s.fechaLimite).toLocaleDateString('es-EC')}` : ''}
                          {s.eventoGoogleId ? ' · 📅' : ''}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{s.descripcion}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.estado === 'ABIERTA' && (
                        <button onClick={() => cambiarEstado(s.id, 'EN_PROCESO')} className="btn-secundario px-2 py-1 text-[11px]">En proceso</button>
                      )}
                      <button onClick={() => cambiarEstado(s.id, 'RESUELTA')} className="btn-secundario px-2 py-1 text-[11px] text-emerald-700">Resuelta</button>
                      <button onClick={() => cambiarEstado(s.id, 'DESCARTADA')} className="btn-secundario px-2 py-1 text-[11px] text-coral-600">Descartar</button>
                    </div>
                  </li>
                ))}
                {delCuadrante.length === 0 && <p className="text-xs text-slate-400">Sin solicitudes.</p>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
