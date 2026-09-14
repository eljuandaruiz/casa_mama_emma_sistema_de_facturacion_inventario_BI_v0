import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hoyISO, type Canal, type Reserva } from '../lib/db';
import { bloquesDe, conflictos, etiquetaHabitaciones, nochesDe, sumarDias } from '../lib/reservas';
import { fmtUsd } from '../lib/dinero';

const CANALES: Canal[] = ['DIRECTO', 'AIRBNB', 'BOOKING', 'OTRO'];

export function FormularioReserva({
  inicial,
  onGuardado,
  onCancelar,
}: {
  inicial?: Partial<Reserva>;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const habitaciones = useLiveQuery(() => db.habitaciones.orderBy('numero').toArray()) ?? [];
  const reservas = useLiveQuery(() => db.reservas.toArray()) ?? [];
  const bloques = bloquesDe(habitaciones);

  const [huesped, setHuesped] = useState(inicial?.huesped ?? '');
  const [telefono, setTelefono] = useState(inicial?.telefono ?? '');
  const [numeros, setNumeros] = useState<number[]>(inicial?.habitaciones ?? []);
  const [checkIn, setCheckIn] = useState(inicial?.checkIn ?? hoyISO());
  const [checkOut, setCheckOut] = useState(inicial?.checkOut ?? sumarDias(inicial?.checkIn ?? hoyISO(), 1));
  const [huespedes, setHuespedes] = useState(String(inicial?.huespedes ?? 2));
  const [canal, setCanal] = useState<Canal>(inicial?.canal ?? 'DIRECTO');
  const [monto, setMonto] = useState(inicial?.montoAcordado ? String(inicial.montoAcordado) : '');
  const [notas, setNotas] = useState(inicial?.notas ?? '');
  const [error, setError] = useState('');

  const alternarBloque = (bloqueNumeros: number[]) => {
    const activo = bloqueNumeros.every((n) => numeros.includes(n));
    setNumeros(activo ? numeros.filter((n) => !bloqueNumeros.includes(n)) : [...new Set([...numeros, ...bloqueNumeros])]);
  };

  const sugerido = bloques.filter((b) => b.numeros.every((n) => numeros.includes(n))).reduce((a, b) => a + b.precioHabitacion, 0) * (checkOut > checkIn ? nochesDe({ checkIn, checkOut }) : 1);

  const guardar = async () => {
    setError('');
    if (!huesped.trim()) return setError('Escribe el nombre del huésped.');
    if (numeros.length === 0) return setError('Elige al menos una habitación.');
    if (checkOut <= checkIn) return setError('La salida debe ser después de la llegada.');
    const ocupadas = conflictos(reservas, numeros, checkIn, checkOut, inicial?.id);
    if (ocupadas.length) return setError(`Ya hay reserva esas fechas en: ${etiquetaHabitaciones(ocupadas)}.`);
    const datos: Omit<Reserva, 'id'> = {
      huesped: huesped.trim(),
      telefono: telefono.trim(),
      habitaciones: [...numeros].sort((a, b) => a - b),
      checkIn,
      checkOut,
      huespedes: Number(huespedes) || 1,
      canal,
      montoAcordado: Number(monto) || 0,
      cobrada: inicial?.cobrada ?? false,
      notas: notas.trim(),
      creadoEn: inicial?.creadoEn ?? Date.now(),
    };
    if (inicial?.id) await db.reservas.update(inicial.id, datos);
    else await db.reservas.add(datos);
    onGuardado();
  };

  return (
    <section className="tarjeta">
      <h2>{inicial?.id ? 'Editar reserva' : 'Nueva reserva'}</h2>
      <label className="etiqueta">Huésped</label>
      <input className="campo" value={huesped} onChange={(e) => setHuesped(e.target.value)} placeholder="Nombre del huésped" />
      <label className="etiqueta">Teléfono (opcional)</label>
      <input className="campo" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
      <label className="etiqueta">Habitaciones</label>
      <div className="chips">
        {bloques.map((b) => (
          <button key={b.clave} type="button" className={`chip ${b.numeros.every((n) => numeros.includes(n)) ? 'activo' : ''}`} onClick={() => alternarBloque(b.numeros)}>
            {b.etiqueta} · {b.capacidad} pax
          </button>
        ))}
      </div>
      <div className="fila">
        <div>
          <label className="etiqueta">Llegada</label>
          <input type="date" className="campo" value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (checkOut <= e.target.value) setCheckOut(sumarDias(e.target.value, 1)); }} />
        </div>
        <div>
          <label className="etiqueta">Salida</label>
          <input type="date" className="campo" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </div>
      </div>
      <div className="fila">
        <div>
          <label className="etiqueta">Huéspedes</label>
          <input type="number" className="campo" value={huespedes} onChange={(e) => setHuespedes(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta">Canal</label>
          <select className="campo" value={canal} onChange={(e) => setCanal(e.target.value as Canal)}>
            {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <label className="etiqueta">Monto acordado (USD){sugerido > 0 ? ` · sugerido por tarifa: ${fmtUsd(sugerido)}` : ''}</label>
      <input type="number" inputMode="decimal" className="campo" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder={sugerido > 0 ? sugerido.toFixed(2) : '0.00'} />
      <label className="etiqueta">Notas (opcional)</label>
      <input className="campo" value={notas} onChange={(e) => setNotas(e.target.value)} />
      {error && <p style={{ color: 'var(--coral-600)', fontSize: 13, marginTop: 8 }}>{error}</p>}
      <div className="fila" style={{ marginTop: 14 }}>
        <button className="btn-secundario btn-bloque" onClick={onCancelar}>Cancelar</button>
        <button className="btn-primario btn-bloque" onClick={guardar}>Guardar reserva</button>
      </div>
    </section>
  );
}
