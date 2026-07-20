'use client';

/**
 * Gestión de obligaciones tributarias: lista con cuenta regresiva, marcar
 * cumplida (avanza a la siguiente fecha) y alta de nuevas.
 */
import { useCallback, useEffect, useState } from 'react';

interface Obligacion {
  id: number;
  nombre: string;
  tipo: string;
  proximoVencimiento: string;
  recurrencia: string;
  entidad: string | null;
  notas: string | null;
  dias: number;
  alerta: 'vencido' | 'urgente' | 'proximo' | 'ok';
}

const COLOR: Record<Obligacion['alerta'], string> = {
  vencido: 'border-coral-500 bg-coral-50',
  urgente: 'border-amber-500 bg-amber-50',
  proximo: 'border-sri-blue/40 bg-sri-light/40',
  ok: 'border-slate-200',
};

const RECURRENCIAS = [
  ['MENSUAL', 'Mensual'],
  ['SEMESTRAL', 'Semestral'],
  ['ANUAL', 'Anual'],
  ['UNICA', 'Única'],
] as const;

export function PanelObligaciones() {
  const [items, setItems] = useState<Obligacion[]>([]);
  const [alta, setAlta] = useState(false);
  const [form, setForm] = useState({ nombre: '', tipo: 'IMPUESTO', proximoVencimiento: '', recurrencia: 'ANUAL', entidad: '', notas: '' });
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    void fetch('/api/obligaciones').then((r) => r.json()).then(setItems);
  }, []);
  useEffect(() => cargar(), [cargar]);

  const cumplir = async (id: number) => {
    await fetch('/api/obligaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    cargar();
  };

  const crear = async () => {
    setError('');
    if (!form.nombre.trim() || !form.proximoVencimiento) return setError('Completa nombre y fecha.');
    const res = await fetch('/api/obligaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ nombre: '', tipo: 'IMPUESTO', proximoVencimiento: '', recurrencia: 'ANUAL', entidad: '', notas: '' });
      setAlta(false);
      cargar();
    } else setError('No se pudo crear.');
  };

  const textoDias = (d: number) =>
    d < 0 ? `Vencida hace ${Math.abs(d)} d.` : d === 0 ? 'Vence HOY' : `Faltan ${d} días`;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Obligaciones tributarias</h1>
          <p className="text-sm text-slate-500">Impuestos, patente y permisos con recordatorio</p>
        </div>
        <button onClick={() => setAlta((v) => !v)} className="btn-primario text-sm">
          {alta ? 'Cerrar' : '+ Obligación'}
        </button>
      </header>

      {alta && (
        <section className="tarjeta space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="etiqueta">Nombre</label>
              <input className="campo" placeholder="Ej.: Patente municipal" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Entidad</label>
              <input className="campo" placeholder="SRI, GAD Baños…" value={form.entidad} onChange={(e) => setForm({ ...form, entidad: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Próximo vencimiento</label>
              <input type="date" className="campo" value={form.proximoVencimiento} onChange={(e) => setForm({ ...form, proximoVencimiento: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Recurrencia</label>
              <select className="campo" value={form.recurrencia} onChange={(e) => setForm({ ...form, recurrencia: e.target.value })}>
                {RECURRENCIAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-coral-600">{error}</p>}
          <button onClick={crear} className="btn-primario w-full">Guardar</button>
        </section>
      )}

      <ul className="space-y-2">
        {items.map((o) => (
          <li key={o.id} className={`tarjeta border-l-4 p-4 ${COLOR[o.alerta]}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{o.nombre}</p>
                <p className="text-xs text-slate-500">
                  {o.entidad ? `${o.entidad} · ` : ''}
                  Vence {new Date(o.proximoVencimiento).toLocaleDateString('es-EC')} · {o.recurrencia.toLowerCase()}
                </p>
                {o.notas && <p className="mt-1 text-xs text-slate-400">{o.notas}</p>}
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${o.dias < 0 ? 'text-coral-600' : o.dias <= 7 ? 'text-amber-600' : 'text-slate-700'}`}>
                  {textoDias(o.dias)}
                </p>
                <button onClick={() => cumplir(o.id)} className="btn-secundario mt-2 px-3 py-1.5 text-xs">
                  ✓ Marcar pagada
                </button>
              </div>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <p className="tarjeta p-8 text-center text-sm text-slate-500">Sin obligaciones registradas.</p>
        )}
      </ul>
    </div>
  );
}
