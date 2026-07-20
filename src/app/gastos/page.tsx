'use client';

/** Registro de gastos con IVA (crédito tributario) y exportación. */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fmtUsd } from '@/lib/money';

interface GastoDto {
  id: number;
  fecha: string;
  categoria: string;
  descripcion: string;
  proveedor: string | null;
  numeroComprobante: string | null;
  subtotal: number;
  iva: number;
  total: number;
  deducible: boolean;
}

interface CategoriaDto {
  id: number;
  valor: string;
  etiqueta: string;
  icono: string | null;
}

const hoyIso = () => new Date().toISOString().slice(0, 10);
const mesActual = () => new Date().toISOString().slice(0, 7);

export default function PaginaGastos() {
  const [mes, setMes] = useState(mesActual());
  const [gastos, setGastos] = useState<GastoDto[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Categorías DINÁMICAS (estilo Wallet): vienen de la BD y el usuario puede
  // crear las suyas (muebles, pinturas, plantas…). Todas deducibles de IVA.
  const [categorias, setCategorias] = useState<CategoriaDto[]>([]);
  const cargarCategorias = useCallback(() => {
    void fetch('/api/gastos/categorias').then((r) => r.json()).then(setCategorias);
  }, []);
  useEffect(() => cargarCategorias(), [cargarCategorias]);

  const etiquetaCategoria = (valor: string) =>
    categorias.find((c) => c.valor === valor)?.etiqueta ?? valor.replaceAll('_', ' ');

  const nuevaCategoria = async () => {
    const etiqueta = prompt('Nombre de la nueva categoría (ej.: Plantas y jardín):');
    if (!etiqueta?.trim()) return;
    const res = await fetch('/api/gastos/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etiqueta: etiqueta.trim() }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error ?? 'No se pudo crear');
    cargarCategorias();
    setForm((prev) => ({ ...prev, categoria: json.valor }));
  };

  const [form, setForm] = useState({
    fecha: hoyIso(),
    categoria: 'INSUMOS',
    descripcion: '',
    proveedor: '',
    numeroComprobante: '',
    subtotal: '',
    iva: '',
    formaPago: 'EFECTIVO',
  });

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/gastos?mes=${mes}`);
    setGastos(await res.json());
  }, [mes]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = async () => {
    if (!form.descripcion || !form.subtotal) return;
    setGuardando(true);
    await fetch('/api/gastos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        subtotal: Number(form.subtotal),
        iva: Number(form.iva) || 0,
        proveedor: form.proveedor || undefined,
        numeroComprobante: form.numeroComprobante || undefined,
      }),
    });
    setForm({ ...form, descripcion: '', proveedor: '', numeroComprobante: '', subtotal: '', iva: '' });
    setMostrarForm(false);
    setGuardando(false);
    void cargar();
  };

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    await fetch(`/api/gastos?id=${id}`, { method: 'DELETE' });
    void cargar();
  };

  const totalMes = gastos.reduce((a, g) => a + g.total, 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Gastos</h1>
        <div className="flex gap-2">
          <input
            type="month"
            className="campo max-w-[170px]"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            aria-label="Filtrar por mes"
          />
          <button onClick={() => setMostrarForm(!mostrarForm)} className="btn-primario">
            {mostrarForm ? 'Cerrar' : '+ Gasto'}
          </button>
          <Link href="/gastos/xml" className="btn-secundario">
            📄 Importar XML
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Total {mes}: <strong className="text-coral-600">{fmtUsd(totalMes)}</strong>
        </p>
        <a href="/api/exportar?formato=csv&tipo=gastos" className="btn-secundario text-xs">
          ⬇️ Gastos .csv
        </a>
      </div>

      {mostrarForm && (
        <section className="tarjeta space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
            <div>
              <label className="etiqueta">Fecha</label>
              <input
                type="date"
                className="campo"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <label className="etiqueta">Categoría</label>
              <div className="flex gap-2">
                <select
                  className="campo flex-1"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                >
                  {categorias.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.icono ? `${c.icono} ` : ''}{c.etiqueta}
                    </option>
                  ))}
                </select>
                {/* Crear una categoría propia al vuelo (estilo Wallet). */}
                <button type="button" onClick={nuevaCategoria} className="btn-secundario shrink-0 px-3" aria-label="Nueva categoría">
                  +
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="etiqueta">Descripción *</label>
            <input
              className="campo"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Ej.: Detergente y toallas"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
            <div>
              <label className="etiqueta">Proveedor</label>
              <input
                className="campo"
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              />
            </div>
            <div>
              <label className="etiqueta">Nº factura proveedor</label>
              <input
                className="campo"
                value={form.numeroComprobante}
                onChange={(e) => setForm({ ...form, numeroComprobante: e.target.value })}
                placeholder="001-001-000000123"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="etiqueta">Subtotal (USD) *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                className="campo"
                value={form.subtotal}
                onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
              />
            </div>
            <div>
              <label className="etiqueta">IVA (USD)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                className="campo"
                value={form.iva}
                onChange={(e) => setForm({ ...form, iva: e.target.value })}
              />
            </div>
          </div>
          <button onClick={guardar} disabled={guardando} className="btn-primario w-full">
            {guardando ? 'Guardando…' : 'Guardar gasto'}
          </button>
        </section>
      )}

      <ul className="space-y-2">
        {gastos.map((g) => (
          <li key={g.id} className="tarjeta flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{g.descripcion}</p>
              <p className="text-xs text-slate-500">
                {new Date(g.fecha).toLocaleDateString('es-EC')} · {etiquetaCategoria(g.categoria)}
                {g.proveedor ? ` · ${g.proveedor}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <p className="font-bold text-coral-600">{fmtUsd(g.total)}</p>
              <button
                onClick={() => eliminar(g.id)}
                className="text-slate-300 transition hover:text-coral-600"
                aria-label="Eliminar gasto"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
        {gastos.length === 0 && (
          <p className="tarjeta p-8 text-center text-sm text-slate-500">Sin gastos en {mes}.</p>
        )}
      </ul>
    </div>
  );
}
