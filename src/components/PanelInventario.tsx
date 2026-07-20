'use client';

/**
 * Inventario de amenidades/consumibles: stock por artículo con alerta de
 * mínimo, entradas/salidas rápidas y alta de artículos nuevos.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CATEGORIAS_OPERATIVAS, categoriaOperativa } from '@/lib/categorias';
import { Icono } from '@/components/Icono';
import { fmtUsd } from '@/lib/money';

interface Articulo {
  id: number;
  nombre: string;
  categoria: string;
  unidad: string;
  stock: number;
  stockMinimo: number;
  valorUnitario: number;
  icono: string | null;
  bajoMinimo: boolean;
}

// Mapa valor->etiqueta de las 15 categorías operativas.
const CATEGORIAS: Record<string, string> = Object.fromEntries(
  CATEGORIAS_OPERATIVAS.map((c) => [c.valor, c.etiqueta]),
);

export function PanelInventario() {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState({ nombre: '', categoria: 'AMENIDADES', unidad: 'unidad', stock: '', stockMinimo: '', valorUnitario: '' });
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    setCargando(true);
    void fetch('/api/inventario')
      .then((r) => r.json())
      .then((d) => {
        setArticulos(d);
        setCargando(false);
      });
  }, []);
  useEffect(() => cargar(), [cargar]);

  const mover = async (articuloId: number, tipo: 'ENTRADA' | 'SALIDA', cantidad = 1) => {
    const res = await fetch('/api/inventario/movimiento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articuloId, tipo, cantidad }),
    });
    if (res.ok) cargar();
  };

  const crear = async () => {
    setError('');
    if (!nuevo.nombre.trim()) return setError('Ponle un nombre al artículo.');
    const res = await fetch('/api/inventario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nuevo.nombre.trim(),
        categoria: nuevo.categoria,
        unidad: nuevo.unidad.trim() || 'unidad',
        stock: Number(nuevo.stock) || 0,
        stockMinimo: Number(nuevo.stockMinimo) || 0,
        valorUnitario: Number(nuevo.valorUnitario) || 0,
      }),
    });
    if (res.ok) {
      setNuevo({ nombre: '', categoria: 'AMENIDADES', unidad: 'unidad', stock: '', stockMinimo: '', valorUnitario: '' });
      setMostrarAlta(false);
      cargar();
    } else setError('No se pudo crear el artículo.');
  };

  const porCategoria = useMemo(() => {
    const map = new Map<string, Articulo[]>();
    for (const a of articulos) {
      const arr = map.get(a.categoria) ?? [];
      arr.push(a);
      map.set(a.categoria, arr);
    }
    return [...map.entries()];
  }, [articulos]);

  const alertas = articulos.filter((a) => a.bajoMinimo);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-sm text-slate-500">Amenidades, ropa de cama y consumibles</p>
        </div>
        <button onClick={() => setMostrarAlta((v) => !v)} className="btn-primario text-sm">
          {mostrarAlta ? 'Cerrar' : '+ Artículo'}
        </button>
      </header>

      {alertas.length > 0 && (
        <div className="tarjeta border-l-4 border-coral-500 bg-coral-50/50 p-4">
          <p className="text-sm font-semibold text-coral-700">⚠️ Reponer pronto ({alertas.length})</p>
          <p className="text-xs text-coral-600">
            {alertas.map((a) => `${a.nombre} (${a.stock} ${a.unidad})`).join(' · ')}
          </p>
        </div>
      )}

      {mostrarAlta && (
        <section className="tarjeta space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="etiqueta">Nombre</label>
              <input className="campo" placeholder="Ej.: Toallas de baño" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Categoría</label>
              <select className="campo" value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}>
                {Object.entries(CATEGORIAS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta">Unidad</label>
              <input className="campo" placeholder="unidad, par, litro…" value={nuevo.unidad} onChange={(e) => setNuevo({ ...nuevo, unidad: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="etiqueta">Stock</label>
                <input type="number" className="campo" value={nuevo.stock} onChange={(e) => setNuevo({ ...nuevo, stock: e.target.value })} />
              </div>
              <div>
                {/* Recomendado: 25% de tu compra habitual → alerta de reposición a tiempo. */}
                <label className="etiqueta">Mínimo (alerta)</label>
                <input type="number" className="campo" value={nuevo.stockMinimo} onChange={(e) => setNuevo({ ...nuevo, stockMinimo: e.target.value })} />
              </div>
              <div>
                <label className="etiqueta">Valor U. (USD)</label>
                <input type="number" step="0.01" className="campo" value={nuevo.valorUnitario} onChange={(e) => setNuevo({ ...nuevo, valorUnitario: e.target.value })} />
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-coral-600">{error}</p>}
          <button onClick={crear} className="btn-primario w-full">Guardar artículo</button>
        </section>
      )}

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
      ) : articulos.length === 0 ? (
        <p className="tarjeta p-8 text-center text-sm text-slate-500">
          Sin artículos aún. Crea el primero con “+ Artículo”.
        </p>
      ) : (
        porCategoria.map(([cat, items]) => (
          <section key={cat}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              {CATEGORIAS[cat] ?? cat}
            </h2>
            <ul className="space-y-2">
              {items.map((a) => (
                <li key={a.id} className={`tarjeta flex items-center justify-between p-3 ${a.bajoMinimo ? 'ring-1 ring-coral-300' : ''}`}>
                  <div className="flex items-center gap-3">
                    {/* Icono visual de la categoría (identificación rápida). */}
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <Icono nombre={a.icono ?? categoriaOperativa(a.categoria).icono} />
                    </span>
                    <div>
                      <p className="font-medium">{a.nombre}</p>
                      <p className="text-xs text-slate-500">
                        <span className={a.bajoMinimo ? 'font-bold text-coral-600' : 'font-semibold text-slate-700'}>
                          {a.stock} {a.unidad}
                        </span>
                        {' '}· mín. {a.stockMinimo}
                        {a.valorUnitario > 0 ? ` · ${fmtUsd(a.valorUnitario)} c/u` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => mover(a.id, 'SALIDA')} className="btn-secundario h-9 w-9 text-lg" aria-label="Restar">−</button>
                    <button onClick={() => mover(a.id, 'ENTRADA')} className="btn-secundario h-9 w-9 text-lg" aria-label="Sumar">+</button>
                    <button onClick={() => mover(a.id, 'ENTRADA', 10)} className="btn-secundario h-9 px-2 text-xs" aria-label="Sumar 10">+10</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {/* Reglas de consumo automático por estadía (agua, champú, jabón, papel…). */}
      <ConsumoPorHabitacion articulos={articulos} />
    </div>
  );
}

// ============ CONSUMO AUTOMÁTICO POR HABITACIÓN (amenities por estadía) ============
interface ReglaConsumo {
  id: number;
  numeroHabitacion: number;
  articuloId: number;
  articulo: string;
  unidad: string;
  valorUnitario: number;
  cantidad: number;
  regla: string;
  costoPorEstadia: number;
  stock: number;
}

const REGLAS_ETIQUETA: Record<string, string> = {
  FIJO: 'fijo por estadía',
  POR_PERSONA: 'por persona',
  CADA_DOS: 'cada 2 personas',
};

function ConsumoPorHabitacion({ articulos }: { articulos: Articulo[] }) {
  const [reglas, setReglas] = useState<ReglaConsumo[]>([]);
  const [habitaciones, setHabitaciones] = useState<{ numero: number; nombre: string }[]>([]);
  const [form, setForm] = useState({ numeroHabitacion: '0', articuloId: '', cantidad: '1', regla: 'POR_PERSONA' });
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    void fetch('/api/inventario/consumibles').then((r) => r.json()).then(setReglas);
  }, []);
  useEffect(() => {
    cargar();
    void fetch('/api/habitaciones').then((r) => r.json()).then(setHabitaciones).catch(() => {});
  }, [cargar]);

  const guardar = async () => {
    setError('');
    if (!form.articuloId) return setError('Elige un artículo.');
    const res = await fetch('/api/inventario/consumibles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numeroHabitacion: Number(form.numeroHabitacion),
        articuloId: Number(form.articuloId),
        cantidad: Number(form.cantidad) || 1,
        regla: form.regla,
      }),
    });
    if (res.ok) {
      setForm({ numeroHabitacion: '0', articuloId: '', cantidad: '1', regla: 'POR_PERSONA' });
      cargar();
    } else setError('No se pudo guardar la regla.');
  };

  const quitar = async (id: number) => {
    await fetch(`/api/inventario/consumibles?id=${id}`, { method: 'DELETE' });
    cargar();
  };

  // Costo total por estadía para una habitación dada = reglas de esa
  // habitación + las generales (numeroHabitacion=0).
  const costoEstadiaHab = (numero: number) =>
    reglas
      .filter((r) => r.numeroHabitacion === 0 || r.numeroHabitacion === numero)
      .reduce((a, r) => a + r.costoPorEstadia, 0);

  return (
    <section className="tarjeta space-y-3 p-4">
      <div>
        <h2 className="font-semibold">Consumo automático por estadía</h2>
        <p className="text-xs text-slate-500">
          Al emitir cada factura, el sistema descuenta estos artículos del stock y suma su costo a la factura
          (agua, champú, jabón, papel…). “Todas” aplica a cualquier habitación facturada.
        </p>
      </div>

      {/* Alta / edición de regla */}
      <div className="grid grid-cols-1 gap-2 xs:grid-cols-5">
        <select className="campo" value={form.numeroHabitacion} onChange={(e) => setForm({ ...form, numeroHabitacion: e.target.value })}>
          <option value="0">Todas las habitaciones</option>
          {habitaciones.map((h) => <option key={h.numero} value={h.numero}>{h.nombre}</option>)}
        </select>
        <select className="campo" value={form.articuloId} onChange={(e) => setForm({ ...form, articuloId: e.target.value })}>
          <option value="">Artículo…</option>
          {articulos.map((a) => <option key={a.id} value={a.id}>{a.nombre} ({fmtUsd(a.valorUnitario)})</option>)}
        </select>
        <input
          type="number"
          min={0.1}
          step="0.1"
          className="campo"
          placeholder="Cantidad"
          value={form.cantidad}
          onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
        />
        {/* Cómo escala con el nº de huéspedes de la factura. */}
        <select className="campo" value={form.regla} onChange={(e) => setForm({ ...form, regla: e.target.value })}>
          <option value="POR_PERSONA">× por persona</option>
          <option value="CADA_DOS">× cada 2 personas</option>
          <option value="FIJO">fijo por estadía</option>
        </select>
        <button onClick={guardar} className="btn-primario text-sm">Guardar regla</button>
      </div>
      {error && <p className="text-sm text-coral-600">{error}</p>}

      {/* Lista de reglas */}
      <ul className="space-y-1 text-sm">
        {reglas.map((r) => (
          <li key={r.id} className="flex items-center justify-between border-b border-slate-50 py-1.5">
            <span>
              <strong>{r.numeroHabitacion === 0 ? 'Todas' : `Hab. ${r.numeroHabitacion}`}</strong>
              {' '}· {r.articulo} × {r.cantidad} ({REGLAS_ETIQUETA[r.regla] ?? r.regla})
              {' '}= <strong>{fmtUsd(r.costoPorEstadia)}</strong> c/u
            </span>
            <button onClick={() => quitar(r.id)} className="text-slate-300 hover:text-coral-600" aria-label="Quitar regla">✕</button>
          </li>
        ))}
        {reglas.length === 0 && <p className="py-2 text-slate-400">Sin reglas aún: las facturas no descuentan consumibles.</p>}
      </ul>

      {/* Resumen: costo de amenities por estadía en cada habitación */}
      {reglas.length > 0 && habitaciones.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {habitaciones.map((h) => (
            <div key={h.numero} className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-xs text-slate-500">{h.nombre}</p>
              <p className="font-bold text-brand-700">{fmtUsd(costoEstadiaHab(h.numero))}<span className="text-xs font-normal text-slate-400">/estadía</span></p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
