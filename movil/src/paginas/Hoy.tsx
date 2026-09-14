import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hoyISO, type Reserva } from '../lib/db';
import { fmtUsd } from '../lib/dinero';
import { diasRestantes, nivelAlerta, textoDias } from '../lib/obligaciones';
import { bloquesDe, etiquetaHabitaciones, ocupadasEn } from '../lib/reservas';
import { SaludoHora } from '../componentes/SaludoHora';
import { FormularioReserva } from '../componentes/FormularioReserva';

export function Hoy({ irA }: { irA: (pestana: 'calendario' | 'mas') => void }) {
  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);
  const [nueva, setNueva] = useState<Partial<Reserva> | null>(null);

  const habitaciones = useLiveQuery(() => db.habitaciones.orderBy('numero').toArray()) ?? [];
  const reservas = useLiveQuery(() => db.reservas.toArray()) ?? [];
  const obligaciones = useLiveQuery(() => db.obligaciones.filter((o) => o.activa).toArray()) ?? [];
  const ingresosMes = useLiveQuery(() => db.ingresos.filter((i) => i.fecha.startsWith(mes)).toArray(), [mes]) ?? [];
  const gastosMes = useLiveQuery(() => db.gastos.filter((g) => g.fecha.startsWith(mes)).toArray(), [mes]) ?? [];
  const trabajosMes = useLiveQuery(() => db.mantenimientos.filter((m) => m.fecha.startsWith(mes)).toArray(), [mes]) ?? [];

  const bloques = bloquesDe(habitaciones);
  const ocupadas = ocupadasEn(reservas, hoy);
  const llegadas = reservas.filter((r) => r.checkIn === hoy);
  const salidas = reservas.filter((r) => r.checkOut === hoy);
  const avisos = obligaciones
    .map((o) => ({ ...o, dias: diasRestantes(o.proximoVencimiento) }))
    .filter((o) => o.dias <= 30)
    .sort((a, b) => a.dias - b.dias);

  const totalIngresos = ingresosMes.reduce((a, i) => a + i.monto, 0);
  const totalEgresos = gastosMes.reduce((a, g) => a + g.monto, 0) + trabajosMes.reduce((a, m) => a + m.costoMateriales + m.costoManoObra, 0);

  if (nueva) return <FormularioReserva inicial={nueva} onGuardado={() => setNueva(null)} onCancelar={() => setNueva(null)} />;

  return (
    <div className="apilado">
      <SaludoHora />

      <div className="kpis">
        <div className="kpi"><p>Ingresos del mes</p><p className="monto-ingreso">{fmtUsd(totalIngresos)}</p></div>
        <div className="kpi"><p>Gastos del mes</p><p className="monto-gasto">{fmtUsd(totalEgresos)}</p></div>
        <div className="kpi"><p>Ocupadas hoy</p><p>{ocupadas.size}/{habitaciones.length}</p></div>
      </div>

      {avisos.length > 0 && (
        <div className="apilado-sm">
          {avisos.map((o) => {
            const nivel = nivelAlerta(o.dias);
            return (
              <div key={o.id} className={`tarjeta tarjeta-tocable aviso aviso-${nivel} entre`} style={{ padding: '12px 14px' }} onClick={() => irA('mas')}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{o.nombre}</p>
                  <p style={{ fontSize: 12, opacity: 0.8 }}>{o.entidad} · Vence el {o.proximoVencimiento}</p>
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{textoDias(o.dias)}</span>
              </div>
            );
          })}
        </div>
      )}

      <section className="tarjeta apilado-sm">
        <div className="entre">
          <h2>Hoy</h2>
          <button className="volver" onClick={() => irA('calendario')}>Ver calendario</button>
        </div>
        {llegadas.length === 0 && salidas.length === 0 && <p className="texto-suave">Sin llegadas ni salidas programadas para hoy.</p>}
        {llegadas.map((r) => (
          <div key={`l${r.id}`} className="entre">
            <div><p className="item-titulo">Llega: {r.huesped}</p><p className="item-detalle">{etiquetaHabitaciones(r.habitaciones)} · {r.huespedes} pax · hasta {r.checkOut}</p></div>
            <span className="pill pill-brand">Llegada</span>
          </div>
        ))}
        {salidas.map((r) => (
          <div key={`s${r.id}`} className="entre">
            <div><p className="item-titulo">Sale: {r.huesped}</p><p className="item-detalle">{etiquetaHabitaciones(r.habitaciones)}</p></div>
            <span className="pill pill-gris">Salida</span>
          </div>
        ))}
      </section>

      <div>
        <h2 style={{ marginBottom: 10 }}>Habitaciones</h2>
        <p className="texto-suave" style={{ marginBottom: 10 }}>Toca una habitación libre para registrar una reserva desde hoy.</p>
        <div className="habitaciones">
          {bloques.map((b) => {
            const reserva = b.numeros.map((n) => ocupadas.get(n)).find(Boolean);
            return (
              <div
                key={b.clave}
                className="tarjeta tarjeta-tocable"
                onClick={() => (reserva ? irA('calendario') : setNueva({ habitaciones: b.numeros, checkIn: hoy }))}
              >
                <div className="entre">
                  <span className={`badge-numero ${reserva ? 'ocupada' : ''}`}>{b.numeros.join('·')}</span>
                  <span className={`pill ${reserva ? 'pill-coral' : 'pill-brand'}`}>{reserva ? 'Ocupada' : 'Libre'}</span>
                </div>
                <p style={{ fontWeight: 600, marginTop: 10 }}>{b.etiqueta}</p>
                <p className="texto-tenue">{b.descripcion}</p>
                <div className="entre" style={{ marginTop: 8 }}>
                  <span className="texto-suave">{b.capacidad} pax</span>
                  <span style={{ color: 'var(--brand-700)', fontWeight: 600, fontSize: 13 }}>{reserva ? reserva.huesped : `${fmtUsd(b.precioHabitacion)}/noche`}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
