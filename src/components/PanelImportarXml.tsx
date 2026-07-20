'use client';

/**
 * CUENTAS POR PAGAR — lector nativo de XML de facturas recibidas.
 *
 * Flujo: (1) el usuario sube uno o varios .xml → (2) se leen como texto en
 * el navegador y se envían al backend para PARSEAR (sin guardar nada aún) →
 * (3) se muestran en una tabla EDITABLE (categoría + toggle "deducible") →
 * (4) al confirmar, se crean los Gasto reales y cada fila deducible se
 * sincroniza (best-effort) a Google Sheets.
 */
import { useCallback, useEffect, useState } from 'react';
import { fmtUsd } from '@/lib/money';

interface CategoriaDto {
  valor: string;
  etiqueta: string;
  icono: string | null;
}

interface FilaPreview {
  archivo: string;
  proveedorNombre: string;
  proveedorRuc: string;
  numeroComprobante: string;
  fechaEmision: string;
  subtotal: number;
  iva: number;
  total: number;
  error?: string;
  // Campos editables por el usuario antes de confirmar:
  categoria: string;
  deducible: boolean;
}

interface ResumenReporte {
  mes: string;
  totales: {
    nGastos: number;
    nDeducibles: number;
    subtotalDeducible: number;
    ivaDeducible: number;
    totalDeducible: number;
    totalNoDeducible: number;
  };
  porCategoria: { categoria: string; n: number; total: number }[];
}

const mesActual = () => new Date().toISOString().slice(0, 7);

export function PanelImportarXml() {
  const [filas, setFilas] = useState<FilaPreview[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [mes, setMes] = useState(mesActual());
  const [reporte, setReporte] = useState<ResumenReporte | null>(null);

  // Categorías dinámicas compartidas con /gastos.
  const [categorias, setCategorias] = useState<CategoriaDto[]>([]);
  useEffect(() => {
    void fetch('/api/gastos/categorias').then((r) => r.json()).then(setCategorias);
  }, []);
  const etiquetaCategoria = (valor: string) =>
    categorias.find((c) => c.valor === valor)?.etiqueta ?? valor.replaceAll('_', ' ');

  const cargarReporte = useCallback(() => {
    void fetch(`/api/gastos/xml/reporte?mes=${mes}`).then((r) => r.json()).then(setReporte);
  }, [mes]);
  useEffect(() => cargarReporte(), [cargarReporte]);

  const subirArchivos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    setMensaje('');
    setCargando(true);
    try {
      // Lee cada .xml como texto en el navegador (nada se sube a un tercero).
      const archivos = await Promise.all(
        Array.from(files).map(
          (f) =>
            new Promise<{ nombre: string; contenido: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ nombre: f.name, contenido: String(reader.result) });
              reader.onerror = reject;
              reader.readAsText(f);
            }),
        ),
      );

      const res = await fetch('/api/gastos/xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivos }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudieron leer los archivos');

      const nuevas: FilaPreview[] = json.resultados.map((r: Omit<FilaPreview, 'categoria' | 'deducible'>) => ({
        ...r,
        categoria: 'INSUMOS',
        deducible: true,
      }));
      setFilas((prev) => [...prev, ...nuevas]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  };

  const actualizarFila = (i: number, cambios: Partial<FilaPreview>) => {
    setFilas((prev) => prev.map((f, j) => (j === i ? { ...f, ...cambios } : f)));
  };
  const quitarFila = (i: number) => setFilas((prev) => prev.filter((_, j) => j !== i));

  const confirmarImportacion = async () => {
    setError('');
    setMensaje('');
    const validas = filas.filter((f) => f.proveedorRuc && f.subtotal >= 0);
    if (validas.length === 0) return setError('No hay filas válidas para importar.');
    setGuardando(true);
    try {
      const res = await fetch('/api/gastos/xml/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filas: validas.map((f) => ({
            fecha: f.fechaEmision,
            categoria: f.categoria,
            proveedor: f.proveedorNombre,
            rucProveedor: f.proveedorRuc,
            numeroComprobante: f.numeroComprobante || undefined,
            subtotal: f.subtotal,
            iva: f.iva,
            deducible: f.deducible,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo importar');
      setMensaje(`✅ ${json.creados} gasto(s) importado(s). Los deducibles se sincronizaron a Google Sheets (si está configurado).`);
      setFilas([]);
      cargarReporte();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Cuentas por pagar · Importar XML</h1>
        <p className="text-sm text-slate-500">
          Sube las facturas electrónicas .xml recibidas de tus proveedores para registrarlas como gasto.
        </p>
      </header>

      {/* ---------- Subida de archivos ---------- */}
      <section className="tarjeta border-l-4 border-sri-blue p-4 md:p-5">
        <label className="btn-primario inline-block cursor-pointer text-sm">
          {cargando ? 'Leyendo…' : '📄 Subir facturas .xml'}
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            multiple
            className="hidden"
            disabled={cargando}
            onChange={(e) => subirArchivos(e.target.files)}
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">Puedes seleccionar varios archivos a la vez.</p>
        {error && <p className="mt-2 rounded-lg bg-coral-50 p-2 text-sm text-coral-600">{error}</p>}
        {mensaje && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{mensaje}</p>}
      </section>

      {/* ---------- Tabla de revisión (editable) ---------- */}
      {filas.length > 0 && (
        <section className="tarjeta overflow-x-auto p-4 md:p-5">
          <h2 className="mb-3 font-semibold">Revisa antes de importar ({filas.length})</h2>
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2">Proveedor</th>
                <th>RUC</th>
                <th>Comprobante</th>
                <th className="text-right">Subtotal</th>
                <th className="text-right">IVA</th>
                <th className="text-right">Total</th>
                <th>Categoría</th>
                <th className="text-center">Deducible</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i} className={`border-b border-slate-50 ${f.error ? 'bg-amber-50/60' : ''}`}>
                  <td className="py-2">
                    <input
                      className="campo py-1 text-sm"
                      value={f.proveedorNombre}
                      onChange={(e) => actualizarFila(i, { proveedorNombre: e.target.value })}
                    />
                    {f.error && <p className="mt-1 text-[11px] text-amber-700">⚠️ {f.error}</p>}
                  </td>
                  <td>
                    <input
                      className="campo py-1 text-sm"
                      value={f.proveedorRuc}
                      onChange={(e) => actualizarFila(i, { proveedorRuc: e.target.value })}
                    />
                  </td>
                  <td className="text-xs text-slate-500">{f.numeroComprobante || '—'}</td>
                  <td className="text-right">{fmtUsd(f.subtotal)}</td>
                  <td className="text-right">{fmtUsd(f.iva)}</td>
                  <td className="text-right font-semibold">{fmtUsd(f.total)}</td>
                  <td>
                    <select
                      className="campo py-1 text-sm"
                      value={f.categoria}
                      onChange={(e) => actualizarFila(i, { categoria: e.target.value })}
                    >
                      {categorias.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
                    </select>
                  </td>
                  <td className="text-center">
                    {/* Toggle "deducible de impuestos" por fila */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={f.deducible}
                      onClick={() => actualizarFila(i, { deducible: !f.deducible })}
                      className={`h-6 w-11 rounded-full transition ${f.deducible ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${f.deducible ? 'translate-x-5' : 'translate-x-0.5'}`}
                      />
                    </button>
                  </td>
                  <td>
                    <button onClick={() => quitarFila(i)} className="text-coral-500 hover:text-coral-700" aria-label="Quitar">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={confirmarImportacion} disabled={guardando} className="btn-primario mt-4 w-full">
            {guardando ? 'Importando…' : `Confirmar e importar ${filas.length} gasto(s)`}
          </button>
        </section>
      )}

      {/* ---------- Reporte / resumen mensual (facilita declaración manual SRI) ---------- */}
      <section className="tarjeta p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Resumen mensual</h2>
          <div className="flex items-center gap-2">
            <input type="month" className="campo py-1.5 text-sm" value={mes} onChange={(e) => setMes(e.target.value)} />
            <a href={`/api/gastos/xml/ats?mes=${mes}`} className="btn-secundario text-xs">
              ⬇️ Exportar ATS (referencia)
            </a>
          </div>
        </div>
        {reporte && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="tarjeta bg-slate-50 p-3">
                <p className="text-xs text-slate-500"># Gastos deducibles</p>
                <p className="text-lg font-bold">{reporte.totales.nDeducibles}</p>
              </div>
              <div className="tarjeta bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Subtotal deducible</p>
                <p className="text-lg font-bold">{fmtUsd(reporte.totales.subtotalDeducible)}</p>
              </div>
              <div className="tarjeta bg-slate-50 p-3">
                <p className="text-xs text-slate-500">IVA deducible</p>
                <p className="text-lg font-bold">{fmtUsd(reporte.totales.ivaDeducible)}</p>
              </div>
              <div className="tarjeta bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Total deducible</p>
                <p className="text-lg font-bold text-emerald-800">{fmtUsd(reporte.totales.totalDeducible)}</p>
              </div>
            </div>
            {reporte.porCategoria.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {reporte.porCategoria.map((c) => (
                  <li key={c.categoria} className="flex justify-between border-b border-slate-50 py-1">
                    <span>{etiquetaCategoria(c.categoria)} ({c.n})</span>
                    <span className="font-semibold">{fmtUsd(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-slate-400">
              El SRI no ofrece una API para subir gastos a tu declaración; este resumen y la exportación ATS
              (de referencia) agilizan la transcripción manual al Formulario 104 / DIMM.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
