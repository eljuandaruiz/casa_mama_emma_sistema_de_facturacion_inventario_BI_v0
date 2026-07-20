'use client';

/**
 * Compras y activos: registra compras (muebles, herramientas, insumos…) con
 * número de factura y proveedor, y muestra la DEPRECIACIÓN calculada por línea
 * recta para los activos (según el reglamento tributario ecuatoriano).
 */
import { useCallback, useEffect, useState } from 'react';
import { fmtUsd } from '@/lib/money';
import { CATEGORIAS_COMPRA } from '@/lib/depreciacion';
import { AREAS } from '@/lib/areas';

interface Proveedor {
  id: number;
  nombre: string;
}
interface Compra {
  id: number;
  descripcion: string;
  categoriaEtiqueta: string;
  esActivo: boolean;
  areaEtiqueta: string;
  total: number;
  numeroFactura: string | null;
  fechaCompra: string;
  proveedor: string | null;
  depreciacion: {
    esActivo: boolean;
    depreciacionAnual: number;
    depreciacionAcumulada: number;
    valorEnLibros: number;
    totalmenteDepreciado: boolean;
  };
}

const FORM_VACIO = {
  descripcion: '',
  categoria: 'MUEBLES',
  area: 'GENERAL',
  costo: '',
  cantidad: '1',
  numeroFactura: '',
  fechaCompra: new Date().toISOString().slice(0, 10),
  proveedorId: '',
};

export function PanelCompras() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [alta, setAlta] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    void fetch('/api/compras').then((r) => r.json()).then(setCompras);
    void fetch('/api/proveedores').then((r) => r.json()).then(setProveedores);
  }, []);
  useEffect(() => cargar(), [cargar]);

  const crear = async () => {
    setError('');
    if (!form.descripcion.trim() || !form.costo) return setError('Completa descripción y costo.');
    const res = await fetch('/api/compras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, proveedorId: form.proveedorId || undefined }),
    });
    if (res.ok) {
      setForm({ ...FORM_VACIO });
      setAlta(false);
      cargar();
    } else setError('No se pudo registrar la compra.');
  };

  // Totales para el resumen
  const totalCompras = compras.reduce((a, c) => a + c.total, 0);
  const valorActivos = compras.filter((c) => c.esActivo).reduce((a, c) => a + c.depreciacion.valorEnLibros, 0);
  const depAnual = compras.filter((c) => c.esActivo).reduce((a, c) => a + c.depreciacion.depreciacionAnual, 0);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compras y activos</h1>
          <p className="text-sm text-slate-500">Muebles, herramientas, insumos y su depreciación</p>
        </div>
        <button onClick={() => setAlta((v) => !v)} className="btn-primario text-sm">
          {alta ? 'Cerrar' : '+ Compra'}
        </button>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <div className="tarjeta p-4">
          <p className="text-xs text-slate-500">Total comprado</p>
          <p className="mt-1 text-lg font-bold text-slate-800 xs:text-xl">{fmtUsd(totalCompras)}</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs text-slate-500">Valor en libros (activos)</p>
          <p className="mt-1 text-lg font-bold text-brand-700 xs:text-xl">{fmtUsd(valorActivos)}</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs text-slate-500">Depreciación anual</p>
          <p className="mt-1 text-lg font-bold text-coral-600 xs:text-xl">{fmtUsd(depAnual)}</p>
        </div>
      </section>

      {alta && (
        <section className="tarjeta space-y-3 p-4">
          <div>
            <label className="etiqueta">Descripción *</label>
            <input className="campo" placeholder="Ej.: Juego de sábanas king" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="etiqueta">Categoría</label>
              <select className="campo" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS_COMPRA.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.etiqueta}{c.esActivo ? ` (deprecia ${c.porcentajeAnual}%)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="etiqueta">Área</label>
              <select className="campo" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
                {AREAS.map((a) => <option key={a.valor} value={a.valor}>{a.etiqueta}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="etiqueta">Costo unit. (USD)</label>
                <input type="number" step="0.01" className="campo" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} />
              </div>
              <div>
                <label className="etiqueta">Cantidad</label>
                <input type="number" step="0.01" className="campo" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="etiqueta">Nº de factura</label>
              <input className="campo" value={form.numeroFactura} onChange={(e) => setForm({ ...form, numeroFactura: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Fecha de compra</label>
              <input type="date" className="campo" value={form.fechaCompra} onChange={(e) => setForm({ ...form, fechaCompra: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Proveedor</label>
              <select className="campo" value={form.proveedorId} onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}>
                <option value="">—</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-coral-600">{error}</p>}
          <button onClick={crear} className="btn-primario w-full">Registrar compra</button>
        </section>
      )}

      <section className="tarjeta overflow-x-auto p-4">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2">Descripción</th>
              <th>Categoría</th>
              <th className="text-right">Total</th>
              <th className="text-right">Dep. anual</th>
              <th className="text-right">Valor en libros</th>
              <th>Factura</th>
            </tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <tr key={c.id} className="border-b border-slate-50">
                <td className="py-2">
                  <p className="font-medium">{c.descripcion}</p>
                  <p className="text-[11px] text-slate-400">{c.areaEtiqueta} · {new Date(c.fechaCompra).toLocaleDateString('es-EC')}{c.proveedor ? ` · ${c.proveedor}` : ''}</p>
                </td>
                <td>
                  {c.categoriaEtiqueta}
                  {c.esActivo && <span className="ml-1 rounded bg-brand-50 px-1 text-[10px] text-brand-700">activo</span>}
                </td>
                <td className="text-right font-medium">{fmtUsd(c.total)}</td>
                <td className="text-right text-coral-600">{c.esActivo ? fmtUsd(c.depreciacion.depreciacionAnual) : '—'}</td>
                <td className="text-right">{c.esActivo ? fmtUsd(c.depreciacion.valorEnLibros) : '—'}</td>
                <td className="text-xs text-slate-500">{c.numeroFactura ?? '—'}</td>
              </tr>
            ))}
            {compras.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-slate-400">Sin compras registradas.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
