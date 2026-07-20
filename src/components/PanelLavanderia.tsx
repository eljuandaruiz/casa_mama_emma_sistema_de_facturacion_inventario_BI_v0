'use client';

/**
 * Lavandería: registra ciclos de lavado (tipo de lencería, nº de piezas y
 * costos de jabón + agua/luz aproximados) y muestra el resumen del mes.
 * El inventario de lencería en sí se gestiona en el módulo de Inventario
 * (categoría "Lencería").
 */
import { useCallback, useEffect, useState } from 'react';
import { fmtUsd } from '@/lib/money';

interface Ciclo {
  id: number;
  fecha: string;
  tipoLencerria: string;
  cantidad: number;
  costoJabon: number;
  costoAguaLuz: number;
  costoTotal: number;
  notas: string | null;
}

const TIPOS: Record<string, string> = {
  SABANAS: 'Sábanas',
  TOALLAS: 'Toallas',
  COBIJAS: 'Cobijas',
  MIXTO: 'Mixto',
};

const FORM_VACIO = {
  fecha: new Date().toISOString().slice(0, 10),
  tipoLenceria: 'MIXTO',
  cantidad: '',
  costoJabon: '',
  costoAguaLuz: '',
  notas: '',
};

export function PanelLavanderia() {
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [resumen, setResumen] = useState({ ciclos: 0, piezas: 0, costo: 0 });
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [alta, setAlta] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    void fetch('/api/lavanderia')
      .then((r) => r.json())
      .then((d) => {
        setCiclos(d.ciclos);
        setResumen(d.resumenMes);
      });
  }, []);
  useEffect(() => cargar(), [cargar]);

  const crear = async () => {
    setError('');
    const res = await fetch('/api/lavanderia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ ...FORM_VACIO });
      setAlta(false);
      cargar();
    } else setError('No se pudo registrar el ciclo.');
  };

  const costoEstimado = (Number(form.costoJabon) || 0) + (Number(form.costoAguaLuz) || 0);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lavandería</h1>
          <p className="text-sm text-slate-500">Ciclos de lavado y sus costos</p>
        </div>
        <button onClick={() => setAlta((v) => !v)} className="btn-primario text-sm">
          {alta ? 'Cerrar' : '+ Ciclo'}
        </button>
      </header>

      {/* Resumen del mes */}
      <section className="grid grid-cols-3 gap-3">
        <div className="tarjeta p-4">
          <p className="text-xs text-slate-500">Ciclos (mes)</p>
          <p className="mt-1 text-lg font-bold xs:text-xl">{resumen.ciclos}</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs text-slate-500">Piezas lavadas</p>
          <p className="mt-1 text-lg font-bold xs:text-xl">{resumen.piezas}</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs text-slate-500">Costo del mes</p>
          <p className="mt-1 text-lg font-bold text-coral-600 xs:text-xl">{fmtUsd(resumen.costo)}</p>
        </div>
      </section>

      {alta && (
        <section className="tarjeta space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="etiqueta">Fecha</label>
              <input type="date" className="campo" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Tipo de lencería</label>
              <select className="campo" value={form.tipoLenceria} onChange={(e) => setForm({ ...form, tipoLenceria: e.target.value })}>
                {Object.entries(TIPOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta">Nº de piezas</label>
              <input type="number" className="campo" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="etiqueta">Jabón (USD)</label>
                <input type="number" step="0.01" className="campo" value={form.costoJabon} onChange={(e) => setForm({ ...form, costoJabon: e.target.value })} />
              </div>
              <div>
                <label className="etiqueta">Agua/Luz (USD)</label>
                <input type="number" step="0.01" className="campo" value={form.costoAguaLuz} onChange={(e) => setForm({ ...form, costoAguaLuz: e.target.value })} />
              </div>
            </div>
          </div>
          <p className="text-sm">Costo del ciclo: <span className="font-bold text-brand-700">{fmtUsd(costoEstimado)}</span></p>
          {error && <p className="text-sm text-coral-600">{error}</p>}
          <button onClick={crear} className="btn-primario w-full">Guardar ciclo</button>
        </section>
      )}

      <section className="tarjeta overflow-x-auto p-4">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2">Fecha</th>
              <th>Tipo</th>
              <th className="text-right">Piezas</th>
              <th className="text-right">Jabón</th>
              <th className="text-right">Agua/Luz</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {ciclos.map((c) => (
              <tr key={c.id} className="border-b border-slate-50">
                <td className="py-2">{new Date(c.fecha).toLocaleDateString('es-EC')}</td>
                <td>{TIPOS[c.tipoLencerria] ?? c.tipoLencerria}</td>
                <td className="text-right">{c.cantidad}</td>
                <td className="text-right">{fmtUsd(c.costoJabon)}</td>
                <td className="text-right">{fmtUsd(c.costoAguaLuz)}</td>
                <td className="text-right font-semibold">{fmtUsd(c.costoTotal)}</td>
              </tr>
            ))}
            {ciclos.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-slate-400">Sin ciclos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
