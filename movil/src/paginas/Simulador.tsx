import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { fmtUsd } from '../lib/dinero';
import { simularPrecio, TARIFAS_IVA, type ModoPrecio, type ResultadoSimulacion } from '../lib/precio';

export function Simulador() {
  const habitaciones = useLiveQuery(() => db.habitaciones.orderBy('numero').toArray()) ?? [];
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [modo, setModo] = useState<ModoPrecio>('HABITACION');
  const [huespedes, setHuespedes] = useState('2');
  const [noches, setNoches] = useState('1');
  const [codigoIva, setCodigoIva] = useState('4');
  const [netoAirbnb, setNetoAirbnb] = useState('');
  const [comisionAirbnb, setComisionAirbnb] = useState('15.5');
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null);
  const [error, setError] = useState('');

  const toggleHabitacion = (numero: number) => {
    setSeleccion((s) => {
      const copia = new Set(s);
      copia.has(numero) ? copia.delete(numero) : copia.add(numero);
      return copia;
    });
  };

  const guardarPrecioHabitacion = async (id: number, campo: 'precioHabitacion' | 'precioPersona', valor: string) => {
    const n = Number(valor);
    if (Number.isNaN(n)) return;
    await db.habitaciones.update(id, { [campo]: n });
  };

  const calcular = () => {
    setError('');
    setResultado(null);
    const seleccionadas = habitaciones.filter((h) => seleccion.has(h.numero));
    if (seleccionadas.length === 0 && modo !== 'AIRBNB') {
      setError('Elige al menos una habitación.');
      return;
    }
    try {
      const r = simularPrecio({
        habitaciones: seleccionadas.length ? seleccionadas : [habitaciones[0]],
        modo,
        huespedes: Number(huespedes) || 1,
        noches: Number(noches) || 1,
        codigoIva,
        netoAirbnbUsd: Number(netoAirbnb) || 0,
        comisionAirbnbPct: Number(comisionAirbnb) || 15.5,
      });
      setResultado(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo calcular.');
    }
  };

  return (
    <div>
      <section className="tarjeta">
        <p className="etiqueta">Simulador de factura (solo calcula — no emite nada al SRI)</p>

        <label className="etiqueta">Modo</label>
        <select className="campo" value={modo} onChange={(e) => setModo(e.target.value as ModoPrecio)}>
          <option value="HABITACION">Precio por habitación</option>
          <option value="PERSONA">Precio por persona</option>
          <option value="CASA_COMPLETA">Casa completa</option>
          <option value="AIRBNB">Airbnb (neto recibido)</option>
        </select>

        {modo !== 'AIRBNB' && (
          <>
            <label className="etiqueta" style={{ marginTop: 8 }}>Habitaciones</label>
            <div className="fila">
              {habitaciones.map((h) => (
                <label key={h.numero} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={seleccion.has(h.numero)} onChange={() => toggleHabitacion(h.numero)} />
                  Hab. {h.numero}
                </label>
              ))}
            </div>
          </>
        )}

        <div className="fila" style={{ marginTop: 8 }}>
          <div>
            <label className="etiqueta">Huéspedes</label>
            <input type="number" className="campo" value={huespedes} onChange={(e) => setHuespedes(e.target.value)} />
          </div>
          <div>
            <label className="etiqueta">Noches</label>
            <input type="number" className="campo" value={noches} onChange={(e) => setNoches(e.target.value)} />
          </div>
          <div>
            <label className="etiqueta">IVA</label>
            <select className="campo" value={codigoIva} onChange={(e) => setCodigoIva(e.target.value)}>
              {TARIFAS_IVA.map((t) => <option key={t.codigo} value={t.codigo}>{t.etiqueta}</option>)}
            </select>
          </div>
        </div>

        {modo === 'AIRBNB' && (
          <div className="fila" style={{ marginTop: 8 }}>
            <div>
              <label className="etiqueta">Neto que te llega (USD)</label>
              <input type="number" inputMode="decimal" className="campo" value={netoAirbnb} onChange={(e) => setNetoAirbnb(e.target.value)} />
            </div>
            <div>
              <label className="etiqueta">Comisión Airbnb (%)</label>
              <input type="number" inputMode="decimal" className="campo" value={comisionAirbnb} onChange={(e) => setComisionAirbnb(e.target.value)} />
            </div>
          </div>
        )}

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
        <button className="btn btn-primario btn-bloque" style={{ marginTop: 10 }} onClick={calcular}>Calcular</button>
      </section>

      {resultado && (
        <section className="tarjeta">
          <p className="etiqueta">Resultado</p>
          <ul className="lista">
            {resultado.detalle.map((d, i) => (
              <li key={i} className="item"><span className="item-detalle">{d.descripcion}</span><span>{fmtUsd(d.valor)}</span></li>
            ))}
          </ul>
          {resultado.airbnb && (
            <p className="item-detalle">Pagado por el turista en Airbnb: {fmtUsd(resultado.airbnb.pagadoPorTurista)} · Comisión: {fmtUsd(resultado.airbnb.comision)}</p>
          )}
          <div className="fila" style={{ marginTop: 8 }}>
            <div><p className="etiqueta">Subtotal</p><p>{fmtUsd(resultado.subtotal)}</p></div>
            <div><p className="etiqueta">IVA ({resultado.tarifaIva}%)</p><p>{fmtUsd(resultado.valorIva)}</p></div>
            <div><p className="etiqueta">Total</p><p style={{ fontWeight: 700 }}>{fmtUsd(resultado.total)}</p></div>
          </div>
        </section>
      )}

      <section className="tarjeta">
        <p className="etiqueta">Tarifas de habitaciones (editable)</p>
        <ul className="lista">
          {habitaciones.map((h) => (
            <li key={h.id} className="item">
              <span className="item-titulo">Hab. {h.numero}</span>
              <div className="fila" style={{ maxWidth: 220 }}>
                <input type="number" className="campo" defaultValue={h.precioHabitacion} onBlur={(e) => guardarPrecioHabitacion(h.id!, 'precioHabitacion', e.target.value)} title="Precio por habitación" />
                <input type="number" className="campo" defaultValue={h.precioPersona} onBlur={(e) => guardarPrecioHabitacion(h.id!, 'precioPersona', e.target.value)} title="Precio por persona" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
