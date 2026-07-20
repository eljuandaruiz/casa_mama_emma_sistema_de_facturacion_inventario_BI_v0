'use client';

/**
 * Catálogo de productos/servicios facturables. Los productos activos aparecen
 * en el formulario de factura como "extras" de un clic. Escalable: sirve igual
 * para servicios del hospedaje que para productos de otro negocio (DTF, etc.).
 */
import { useCallback, useEffect, useState } from 'react';
import { fmtUsd } from '@/lib/money';

interface Producto {
  id: number;
  codigo: string;
  descripcion: string;
  precioUnitario: number;
  codigoIva: string;
  activo: boolean;
}

const IVA_LABEL: Record<string, string> = { '4': 'IVA 15%', '8': 'IVA 8%', '0': 'IVA 0%' };

export function PanelProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [form, setForm] = useState({ codigo: '', descripcion: '', precioUnitario: '', codigoIva: '4' });
  const [error, setError] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const cargar = useCallback(() => {
    void fetch(`/api/productos${mostrarInactivos ? '?todos=1' : ''}`).then((r) => r.json()).then(setProductos);
  }, [mostrarInactivos]);
  useEffect(() => cargar(), [cargar]);

  const crear = async () => {
    setError('');
    if (!form.codigo || !form.descripcion || !form.precioUnitario) {
      return setError('Completa código, descripción y precio.');
    }
    const res = await fetch('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, precioUnitario: Number(form.precioUnitario) }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error ?? 'No se pudo crear');
    setForm({ codigo: '', descripcion: '', precioUnitario: '', codigoIva: '4' });
    cargar();
  };

  const alternarActivo = async (p: Producto) => {
    await fetch('/api/productos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, activo: !p.activo }),
    });
    cargar();
  };

  const editarPrecio = async (p: Producto) => {
    const nuevo = prompt(`Nuevo precio para ${p.descripcion}:`, String(p.precioUnitario));
    if (nuevo === null) return;
    const n = Number(nuevo);
    if (Number.isNaN(n) || n < 0) return alert('Precio inválido');
    await fetch('/api/productos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, precioUnitario: n }),
    });
    cargar();
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Productos y servicios</h1>
        <p className="text-sm text-slate-500">
          Catálogo facturable por el SRI: lo que crees aquí aparece como “extra” de un clic al facturar.
        </p>
      </header>

      {/* Alta */}
      <section className="tarjeta space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="etiqueta">Código (SRI)</label>
            <input className="campo uppercase" placeholder="SERV-TOUR" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
          </div>
          <div>
            <label className="etiqueta">Descripción</label>
            <input className="campo" placeholder="Tour a la cascada" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div>
            <label className="etiqueta">Precio (USD, sin IVA)</label>
            <input type="number" min={0} step="0.01" inputMode="decimal" className="campo" value={form.precioUnitario} onChange={(e) => setForm({ ...form, precioUnitario: e.target.value })} />
          </div>
          <div>
            <label className="etiqueta">Tarifa IVA</label>
            <select className="campo" value={form.codigoIva} onChange={(e) => setForm({ ...form, codigoIva: e.target.value })}>
              <option value="4">15% (cód. 4)</option>
              <option value="8">8% feriados (cód. 8)</option>
              <option value="0">0% (cód. 0)</option>
            </select>
          </div>
        </div>
        {error && <p className="text-sm text-coral-600">{error}</p>}
        <button onClick={crear} className="btn-primario w-full">Crear producto</button>
      </section>

      {/* Lista */}
      <section className="tarjeta p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Catálogo ({productos.length})</h2>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} />
            Ver inactivos
          </label>
        </div>
        <ul className="space-y-2">
          {productos.map((p) => (
            <li key={p.id} className={`flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm ${!p.activo ? 'opacity-50' : ''}`}>
              <div>
                <p className="font-medium">{p.descripcion}</p>
                <p className="text-xs text-slate-500">{p.codigo} · {IVA_LABEL[p.codigoIva] ?? p.codigoIva}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => editarPrecio(p)} className="font-bold text-brand-700 underline decoration-dotted">
                  {fmtUsd(p.precioUnitario)}
                </button>
                <button onClick={() => alternarActivo(p)} className="btn-secundario px-2 py-1 text-xs">
                  {p.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </li>
          ))}
          {productos.length === 0 && <p className="py-4 text-center text-slate-400">Sin productos aún.</p>}
        </ul>
      </section>
    </div>
  );
}
