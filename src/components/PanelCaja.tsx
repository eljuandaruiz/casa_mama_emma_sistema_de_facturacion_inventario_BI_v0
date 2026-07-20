'use client';

/**
 * CAJA DIARIA / CIERRE DE TURNO — reconciliación del efectivo físico.
 * Muestra el efectivo esperado (facturas en efectivo − gastos en efectivo,
 * desde el último cierre) y pide el conteo físico para calcular la
 * diferencia (sobra/falta). El servidor recalcula todo al cerrar: el
 * cliente solo envía el conteo y una nota opcional.
 */
import { useCallback, useEffect, useState } from 'react';
import { fmtUsd } from '@/lib/money';

interface PeriodoActual {
  desde: string;
  hasta: string;
  saldoInicial: number;
  ingresosEfectivo: number;
  egresosEfectivo: number;
  efectivoEsperado: number;
  nFacturas: number;
}
interface Cierre {
  id: number;
  fecha: string;
  desde: string;
  hasta: string;
  usuario: string;
  saldoInicial: number;
  ingresosEfectivo: number;
  egresosEfectivo: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
  nFacturas: number;
  notas: string | null;
}

const fmtFechaHora = (s: string) => new Date(s).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });

export function PanelCaja() {
  const [periodo, setPeriodo] = useState<PeriodoActual | null>(null);
  const [historial, setHistorial] = useState<Cierre[]>([]);
  const [efectivoContado, setEfectivoContado] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<Cierre | null>(null);
  const [cerrando, setCerrando] = useState(false);

  const cargar = useCallback(() => {
    void fetch('/api/caja')
      .then((r) => r.json())
      .then((json) => {
        setPeriodo(json.periodoActual);
        setHistorial(json.historial);
      });
  }, []);

  useEffect(() => cargar(), [cargar]);

  const cerrarCaja = async () => {
    setError('');
    setResultado(null);
    const monto = Number(efectivoContado);
    if (!efectivoContado || Number.isNaN(monto) || monto < 0) {
      setError('Ingresa el efectivo contado.');
      return;
    }
    setCerrando(true);
    try {
      const res = await fetch('/api/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ efectivoContado: monto, notas: notas.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo cerrar la caja');
      setResultado(json);
      setEfectivoContado('');
      setNotas('');
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCerrando(false);
    }
  };

  if (!periodo) return <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Caja diaria</h1>
        <p className="text-sm text-slate-500">Cierre de turno: cuenta el efectivo y concilia contra el sistema.</p>
      </header>

      {/* Período abierto (desde el último cierre) */}
      <section className="tarjeta p-4">
        <h2 className="mb-1 font-semibold">Turno abierto</h2>
        <p className="mb-3 text-xs text-slate-400">
          Desde {fmtFechaHora(periodo.desde)} hasta ahora · {periodo.nFacturas} factura(s) en efectivo
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span>Saldo inicial (cierre anterior)</span><span className="font-medium">{fmtUsd(periodo.saldoInicial)}</span></li>
          <li className="flex justify-between text-emerald-700"><span>+ Ingresos en efectivo</span><span className="font-medium">{fmtUsd(periodo.ingresosEfectivo)}</span></li>
          <li className="flex justify-between text-coral-600"><span>− Gastos en efectivo</span><span className="font-medium">{fmtUsd(periodo.egresosEfectivo)}</span></li>
          <li className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold">
            <span>Efectivo esperado en caja</span><span className="text-brand-700">{fmtUsd(periodo.efectivoEsperado)}</span>
          </li>
        </ul>
      </section>

      {/* Formulario de cierre */}
      <section className="tarjeta space-y-3 p-4">
        <h2 className="font-semibold">Cerrar turno</h2>
        <div>
          <label className="etiqueta">Efectivo contado (conteo físico) *</label>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            className="campo"
            value={efectivoContado}
            onChange={(e) => setEfectivoContado(e.target.value)}
          />
        </div>
        <div>
          <label className="etiqueta">Notas (opcional)</label>
          <textarea className="campo min-h-[64px]" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej.: faltante por vuelto no registrado" />
        </div>
        {error && <p className="rounded-lg bg-coral-50 p-2 text-sm text-coral-600">{error}</p>}
        {resultado && (
          <p
            className={`rounded-lg p-3 text-sm font-semibold ${
              resultado.diferencia === 0
                ? 'bg-emerald-50 text-emerald-700'
                : resultado.diferencia > 0
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-coral-50 text-coral-600'
            }`}
          >
            {resultado.diferencia === 0
              ? '✅ Caja cuadrada, sin diferencia.'
              : resultado.diferencia > 0
                ? `↑ Sobrante de ${fmtUsd(resultado.diferencia)}`
                : `↓ Faltante de ${fmtUsd(Math.abs(resultado.diferencia))}`}
          </p>
        )}
        <button onClick={cerrarCaja} disabled={cerrando} className="btn-primario w-full">
          {cerrando ? 'Cerrando…' : 'Cerrar caja'}
        </button>
      </section>

      {/* Historial de cierres */}
      <section className="tarjeta overflow-x-auto p-4">
        <h2 className="mb-3 font-semibold">Historial de cierres</h2>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2">Fecha</th>
              <th>Usuario</th>
              <th className="text-right">Esperado</th>
              <th className="text-right">Contado</th>
              <th className="text-right">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {historial.map((c) => (
              <tr key={c.id} className="border-b border-slate-50">
                <td className="py-2">{fmtFechaHora(c.fecha)}</td>
                <td>{c.usuario}</td>
                <td className="text-right">{fmtUsd(c.efectivoEsperado)}</td>
                <td className="text-right">{fmtUsd(c.efectivoContado)}</td>
                <td className={`text-right font-semibold ${c.diferencia === 0 ? 'text-slate-500' : c.diferencia > 0 ? 'text-amber-600' : 'text-coral-600'}`}>
                  {c.diferencia === 0 ? '—' : fmtUsd(c.diferencia)}
                </td>
              </tr>
            ))}
            {historial.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-slate-400">Sin cierres registrados aún.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
