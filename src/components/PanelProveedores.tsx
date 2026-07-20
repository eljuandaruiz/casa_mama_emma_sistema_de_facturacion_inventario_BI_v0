'use client';

/**
 * Directorio de proveedores: centraliza a quién se le compra (RUC, contacto,
 * categoría). Se enlaza con el módulo de Compras.
 */
import { useCallback, useEffect, useState } from 'react';

interface Proveedor {
  id: number;
  nombre: string;
  ruc: string | null;
  categoria: string | null;
  telefono: string | null;
  email: string | null;
  nCompras: number;
}

const FORM_VACIO = { nombre: '', ruc: '', categoria: 'FERRETERIA', telefono: '', email: '', direccion: '', notas: '' };
const CATS = [
  ['FERRETERIA', 'Ferretería'],
  ['MUEBLES', 'Muebles'],
  ['INSUMOS', 'Insumos'],
  ['SERVICIOS', 'Servicios'],
  ['OTROS', 'Otros'],
] as const;

export function PanelProveedores() {
  const [items, setItems] = useState<Proveedor[]>([]);
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [alta, setAlta] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    void fetch('/api/proveedores').then((r) => r.json()).then(setItems);
  }, []);
  useEffect(() => cargar(), [cargar]);

  const crear = async () => {
    setError('');
    if (!form.nombre.trim()) return setError('Ingresa el nombre del proveedor.');
    const res = await fetch('/api/proveedores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (res.ok) {
      setForm({ ...FORM_VACIO });
      setAlta(false);
      cargar();
    } else setError(json.error ?? 'No se pudo crear.');
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proveedores</h1>
          <p className="text-sm text-slate-500">A quién le compramos</p>
        </div>
        <button onClick={() => setAlta((v) => !v)} className="btn-primario text-sm">
          {alta ? 'Cerrar' : '+ Proveedor'}
        </button>
      </header>

      {alta && (
        <section className="tarjeta space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="etiqueta">Nombre *</label>
              <input className="campo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">RUC (opcional)</label>
              <input className="campo" value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Categoría</label>
              <select className="campo" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {CATS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta">Teléfono</label>
              <input className="campo" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Email</label>
              <input className="campo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Dirección</label>
              <input className="campo" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-coral-600">{error}</p>}
          <button onClick={crear} className="btn-primario w-full">Guardar proveedor</button>
        </section>
      )}

      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.id} className="tarjeta flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{p.nombre}</p>
              <p className="text-xs text-slate-500">
                {p.categoria ?? '—'}{p.ruc ? ` · RUC ${p.ruc}` : ''}{p.telefono ? ` · ${p.telefono}` : ''}
              </p>
            </div>
            <span className="text-xs text-slate-400">{p.nCompras} compra(s)</span>
          </li>
        ))}
        {items.length === 0 && <p className="tarjeta p-8 text-center text-sm text-slate-500">Sin proveedores aún.</p>}
      </ul>
    </div>
  );
}
