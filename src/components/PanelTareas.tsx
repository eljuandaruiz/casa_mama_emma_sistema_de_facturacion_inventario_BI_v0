'use client';

/**
 * TAREAS / AGENDA — pendientes + completadas, con sincronización best-effort
 * a Google Calendar (cuenta conectada en /integraciones). El icono 📅 indica
 * que la tarea ya existe como evento en el calendario.
 */
import { useCallback, useEffect, useState } from 'react';

interface Tarea {
  id: number;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  duracionMin: number;
  completada: boolean;
  origen: string;
  eventoGoogleId: string | null;
}

const fmtFechaHora = (s: string) =>
  new Date(s).toLocaleString('es-EC', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const ahoraLocal = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000); // dentro de 1 hora
  d.setMinutes(0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function PanelTareas() {
  const [pendientes, setPendientes] = useState<Tarea[]>([]);
  const [completadas, setCompletadas] = useState<Tarea[]>([]);
  const [form, setForm] = useState({ titulo: '', descripcion: '', fecha: ahoraLocal(), duracionMin: '60' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    void fetch('/api/tareas').then((r) => r.json()).then((j) => {
      setPendientes(j.pendientes);
      setCompletadas(j.completadas);
    });
  }, []);
  useEffect(() => cargar(), [cargar]);

  const crear = async () => {
    setError('');
    if (!form.titulo.trim()) return setError('Ponle un título a la tarea.');
    setGuardando(true);
    try {
      const res = await fetch('/api/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: form.titulo.trim(),
          descripcion: form.descripcion.trim() || undefined,
          fecha: form.fecha,
          duracionMin: Number(form.duracionMin) || 60,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'No se pudo crear');
      setForm({ titulo: '', descripcion: '', fecha: ahoraLocal(), duracionMin: '60' });
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const alternar = async (t: Tarea) => {
    await fetch('/api/tareas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, completada: !t.completada }),
    });
    cargar();
  };

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    await fetch(`/api/tareas?id=${id}`, { method: 'DELETE' });
    cargar();
  };

  const Item = ({ t }: { t: Tarea }) => (
    <li className="tarjeta flex items-center justify-between gap-3 p-3">
      <label className="flex flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5 accent-brand-600"
          checked={t.completada}
          onChange={() => alternar(t)}
        />
        <div className="min-w-0">
          <p className={`truncate font-medium ${t.completada ? 'text-slate-400 line-through' : ''}`}>
            {t.titulo}
            {t.eventoGoogleId && <span title="Sincronizada a Google Calendar"> 📅</span>}
          </p>
          <p className="text-xs text-slate-500">
            {fmtFechaHora(t.fecha)} · {t.duracionMin} min
            {t.origen !== 'MANUAL' ? ` · ${t.origen.toLowerCase()}` : ''}
          </p>
          {t.descripcion && <p className="truncate text-xs text-slate-400">{t.descripcion}</p>}
        </div>
      </label>
      <button onClick={() => eliminar(t.id)} className="text-slate-300 hover:text-coral-600" aria-label="Eliminar">✕</button>
    </li>
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Tareas y agenda</h1>
        <p className="text-sm text-slate-500">
          Las tareas se suben automáticamente a tu Google Calendar si está conectado en Integraciones.
        </p>
      </header>

      {/* Nueva tarea */}
      <section className="tarjeta space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
          <div className="xs:col-span-2">
            <label className="etiqueta">Título *</label>
            <input className="campo" placeholder="Ej.: Pagar IVA / Recibir huésped de la 5" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div>
            <label className="etiqueta">Fecha y hora</label>
            <input type="datetime-local" className="campo" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <div>
            <label className="etiqueta">Duración (min)</label>
            <input type="number" min={5} step={5} className="campo" value={form.duracionMin} onChange={(e) => setForm({ ...form, duracionMin: e.target.value })} />
          </div>
          <div className="xs:col-span-2">
            <label className="etiqueta">Detalle (opcional)</label>
            <textarea className="campo min-h-[56px]" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
        </div>
        {error && <p className="rounded-lg bg-coral-50 p-2 text-sm text-coral-600">{error}</p>}
        <button onClick={crear} disabled={guardando} className="btn-primario w-full">
          {guardando ? 'Guardando…' : 'Crear tarea'}
        </button>
      </section>

      {/* Pendientes */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Pendientes ({pendientes.length})
        </h2>
        <ul className="space-y-2">
          {pendientes.map((t) => <Item key={t.id} t={t} />)}
          {pendientes.length === 0 && <p className="tarjeta p-6 text-center text-sm text-slate-400">Nada pendiente. 🎉</p>}
        </ul>
      </section>

      {/* Completadas recientes */}
      {completadas.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Completadas</h2>
          <ul className="space-y-2">
            {completadas.map((t) => <Item key={t.id} t={t} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
