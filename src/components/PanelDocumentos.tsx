'use client';

/**
 * DOCUMENTOS AUTOMÁTICOS — genera reportes contables del mes como pestañas
 * del libro de Google Sheets (cuenta de servicio configurada en .env), con
 * sumas automáticas. Interconecta ventas, gastos y crédito tributario.
 */
import { useState } from 'react';

const TIPOS = [
  { valor: 'VENTAS', titulo: 'Facturas emitidas (ventas)', detalle: 'Todas las facturas del mes con base, IVA, total y estado SRI, con totales sumados.' },
  { valor: 'GASTOS', titulo: 'Facturas recibidas (gastos)', detalle: 'Gastos del mes con proveedor, RUC, categoría y si son deducibles.' },
  { valor: 'CREDITO_TRIBUTARIO', titulo: 'Crédito tributario (IVA)', detalle: 'IVA cobrado vs. IVA pagado en compras deducibles → IVA a pagar, con referencia al F.104.' },
] as const;

const mesActual = () => new Date().toISOString().slice(0, 7);

export function PanelDocumentos() {
  const [mes, setMes] = useState(mesActual());
  const [generando, setGenerando] = useState('');
  const [resultados, setResultados] = useState<Record<string, { url?: string; error?: string }>>({});

  const generar = async (tipo: string) => {
    setGenerando(tipo);
    setResultados((prev) => ({ ...prev, [tipo]: {} }));
    try {
      const res = await fetch('/api/documentos/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, tipo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo generar');
      setResultados((prev) => ({ ...prev, [tipo]: { url: json.url } }));
    } catch (e) {
      setResultados((prev) => ({ ...prev, [tipo]: { error: (e as Error).message } }));
    } finally {
      setGenerando('');
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Documentos automáticos</h1>
        <p className="text-sm text-slate-500">
          Genera reportes contables del mes directo en tu libro de Google Sheets, con sumas automáticas.
        </p>
      </header>

      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-500" htmlFor="mes-doc">Mes:</label>
        <input id="mes-doc" type="month" className="campo max-w-[180px]" value={mes} onChange={(e) => setMes(e.target.value)} />
      </div>

      <div className="space-y-3">
        {TIPOS.map((t) => {
          const r = resultados[t.valor] ?? {};
          return (
            <section key={t.valor} className="tarjeta flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{t.titulo}</h2>
                <p className="text-xs text-slate-500">{t.detalle}</p>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-brand-700 underline">
                    Abrir en Google Sheets ↗
                  </a>
                )}
                {r.error && <p className="mt-1 text-xs text-coral-600">{r.error}</p>}
              </div>
              <button
                onClick={() => generar(t.valor)}
                disabled={generando !== ''}
                className="btn-primario text-sm"
              >
                {generando === t.valor ? 'Generando…' : 'Generar'}
              </button>
            </section>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400">
        Requiere la cuenta de servicio de Google configurada (.env: GOOGLE_SERVICE_ACCOUNT_* y GOOGLE_SHEETS_SPREADSHEET_ID).
        Cada generación reemplaza la pestaña del mismo mes, así siempre queda la versión más reciente.
      </p>
    </div>
  );
}
