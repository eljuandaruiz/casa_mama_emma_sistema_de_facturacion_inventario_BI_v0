'use client';

/**
 * OCUPACIÓN — calendario habitación × día para evitar overbooking entre
 * Airbnb (iCal) y reservas/facturas directas.
 *  · Calendario: pinta los bloques ocupados de cada habitación en el mes.
 *  · Reservas sin habitación asignada: Airbnb rara vez indica la habitación
 *    exacta por iCal; aquí se asigna a mano para que el calendario la cruce.
 *  · Nuevo hold manual: bloquea una habitación (venta directa / llamada)
 *    ANTES de facturar, con validación dura de solapamiento.
 */
import { useCallback, useEffect, useState } from 'react';

interface Habitacion {
  id: number;
  numero: number;
  nombre: string;
}
interface BloqueOcupacion {
  origen: 'AIRBNB' | 'BOOKING' | 'MANUAL' | 'FACTURA';
  etiqueta: string;
  checkIn: string;
  checkOut: string;
  numeroHabitacion: number | null;
  reservaId?: number;
  facturaId?: string;
}
interface DatosMes {
  anio: number;
  mes: number;
  habitaciones: Habitacion[];
  ocupaciones: BloqueOcupacion[];
}

const COLOR_ORIGEN: Record<BloqueOcupacion['origen'], string> = {
  AIRBNB: '#f43f5e',
  BOOKING: '#8b5cf6',
  MANUAL: '#3b82f6',
  FACTURA: '#0d9488',
};
const ETIQUETA_ORIGEN: Record<BloqueOcupacion['origen'], string> = {
  AIRBNB: 'Airbnb',
  BOOKING: 'Booking',
  MANUAL: 'Hold manual',
  FACTURA: 'Facturada',
};

const hoyIso = () => new Date().toISOString().slice(0, 10);

export function PanelOcupacion() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1); // 1..12
  const [datos, setDatos] = useState<DatosMes | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    void fetch(`/api/ocupacion?anio=${anio}&mes=${mes}`)
      .then((r) => r.json())
      .then(setDatos)
      .finally(() => setCargando(false));
  }, [anio, mes]);

  useEffect(() => cargar(), [cargar]);

  const mesAnterior = () => {
    if (mes === 1) { setMes(12); setAnio(anio - 1); } else setMes(mes - 1);
  };
  const mesSiguiente = () => {
    if (mes === 12) { setMes(1); setAnio(anio + 1); } else setMes(mes + 1);
  };

  const nombreMes = new Date(anio, mes - 1, 1).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
  const diasEnMes = new Date(anio, mes, 0).getDate();
  const dias = Array.from({ length: diasEnMes }, (_, i) => i + 1);

  const sinAsignar = datos?.ocupaciones.filter((o) => o.numeroHabitacion == null) ?? [];

  const ocupaEseDia = (habNumero: number, dia: number) => {
    const fecha = new Date(anio, mes - 1, dia);
    const siguiente = new Date(anio, mes - 1, dia + 1);
    return datos?.ocupaciones.find(
      (o) =>
        o.numeroHabitacion === habNumero &&
        new Date(o.checkIn) < siguiente &&
        new Date(o.checkOut) > fecha,
    );
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Ocupación</h1>
        <p className="text-sm text-slate-500">
          Calendario de disponibilidad: Airbnb (iCal) + facturas + holds manuales, cruzados por habitación.
        </p>
      </header>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.keys(COLOR_ORIGEN) as BloqueOcupacion['origen'][]).map((o) => (
          <span key={o} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded" style={{ backgroundColor: COLOR_ORIGEN[o] }} />
            {ETIQUETA_ORIGEN[o]}
          </span>
        ))}
      </div>

      {/* Calendario */}
      <section className="tarjeta overflow-x-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={mesAnterior} className="btn-secundario px-3">←</button>
          <h2 className="font-semibold capitalize">{nombreMes}</h2>
          <button onClick={mesSiguiente} className="btn-secundario px-3">→</button>
        </div>

        {cargando || !datos ? (
          <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[120px] bg-white p-1 text-left">Habitación</th>
                {dias.map((d) => (
                  <th key={d} className="w-6 p-0.5 text-center font-normal text-slate-400">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.habitaciones.map((h) => (
                <tr key={h.id}>
                  <td className="sticky left-0 z-10 bg-white p-1 font-medium">{h.nombre}</td>
                  {dias.map((d) => {
                    const b = ocupaEseDia(h.numero, d);
                    return (
                      <td key={d} className="p-0.5">
                        <div
                          className="h-5 w-5 rounded"
                          style={{ backgroundColor: b ? COLOR_ORIGEN[b.origen] : '#f1f5f9' }}
                          title={b ? `${ETIQUETA_ORIGEN[b.origen]} · ${b.etiqueta}` : 'Libre'}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Reservas sin habitación asignada (típico de Airbnb por iCal) */}
      {sinAsignar.length > 0 && datos && (
        <section className="tarjeta p-4">
          <h2 className="mb-1 font-semibold">Reservas sin habitación asignada ({sinAsignar.length})</h2>
          <p className="mb-3 text-xs text-slate-400">
            Airbnb no siempre indica la habitación exacta por iCal. Asígnala para que el calendario la cruce y evite overbooking.
          </p>
          <ul className="space-y-2">
            {sinAsignar.map((o) => (
              <AsignarHabitacion key={o.reservaId} bloque={o} habitaciones={datos.habitaciones} onAsignado={cargar} />
            ))}
          </ul>
        </section>
      )}

      {/* Nuevo hold manual */}
      <NuevoHold habitaciones={datos?.habitaciones ?? []} onCreado={cargar} />
    </div>
  );
}

function AsignarHabitacion({
  bloque,
  habitaciones,
  onAsignado,
}: {
  bloque: BloqueOcupacion;
  habitaciones: Habitacion[];
  onAsignado: () => void;
}) {
  const [numero, setNumero] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const asignar = async () => {
    if (!numero) return;
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/reservas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bloque.reservaId, numeroHabitacion: Number(numero) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo asignar');
      onAsignado();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-2 text-sm">
      <div>
        <p className="font-medium">{bloque.etiqueta}</p>
        <p className="text-xs text-slate-500">
          {new Date(bloque.checkIn).toLocaleDateString('es-EC')} → {new Date(bloque.checkOut).toLocaleDateString('es-EC')}
        </p>
        {error && <p className="text-xs text-coral-600">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        <select className="campo py-1 text-sm" value={numero} onChange={(e) => setNumero(e.target.value)}>
          <option value="">Habitación…</option>
          {habitaciones.map((h) => <option key={h.id} value={h.numero}>{h.nombre}</option>)}
        </select>
        <button onClick={asignar} disabled={!numero || guardando} className="btn-secundario px-3 text-xs">
          {guardando ? 'Guardando…' : 'Asignar'}
        </button>
      </div>
    </li>
  );
}

function NuevoHold({ habitaciones, onCreado }: { habitaciones: Habitacion[]; onCreado: () => void }) {
  const [form, setForm] = useState({
    huespedNombre: '',
    numHuespedes: '',
    checkIn: hoyIso(),
    checkOut: hoyIso(),
    numeroHabitacion: '',
  });
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const crear = async () => {
    setError('');
    setOk(false);
    if (!form.huespedNombre || !form.numeroHabitacion || !form.checkIn || !form.checkOut) {
      setError('Completa huésped, habitación y fechas.');
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          huespedNombre: form.huespedNombre,
          numHuespedes: form.numHuespedes || undefined,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          numeroHabitacion: Number(form.numeroHabitacion),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo crear el hold');
      setOk(true);
      setForm({ huespedNombre: '', numHuespedes: '', checkIn: hoyIso(), checkOut: hoyIso(), numeroHabitacion: '' });
      onCreado();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="tarjeta space-y-3 p-4">
      <h2 className="font-semibold">Nuevo hold manual (venta directa)</h2>
      <p className="text-xs text-slate-400">
        Bloquea una habitación antes de facturar. Se rechaza si ya está ocupada (Airbnb, factura u otro hold).
      </p>
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <div>
          <label className="etiqueta">Huésped *</label>
          <input className="campo" value={form.huespedNombre} onChange={(e) => setForm({ ...form, huespedNombre: e.target.value })} />
        </div>
        <div>
          <label className="etiqueta">Nº huéspedes</label>
          <input type="number" min={1} className="campo" value={form.numHuespedes} onChange={(e) => setForm({ ...form, numHuespedes: e.target.value })} />
        </div>
        <div>
          <label className="etiqueta">Check-in *</label>
          <input type="date" className="campo" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
        </div>
        <div>
          <label className="etiqueta">Check-out *</label>
          <input type="date" className="campo" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
        </div>
        <div>
          <label className="etiqueta">Habitación *</label>
          <select className="campo" value={form.numeroHabitacion} onChange={(e) => setForm({ ...form, numeroHabitacion: e.target.value })}>
            <option value="">—</option>
            {habitaciones.map((h) => <option key={h.id} value={h.numero}>{h.nombre}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="rounded-lg bg-coral-50 p-2 text-sm text-coral-600">{error}</p>}
      {ok && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">✅ Hold creado.</p>}
      <button onClick={crear} disabled={guardando} className="btn-primario w-full">
        {guardando ? 'Guardando…' : 'Crear hold'}
      </button>
    </section>
  );
}
