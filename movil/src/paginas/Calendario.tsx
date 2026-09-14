import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hoyISO, type Reserva } from '../lib/db';
import { fmtUsd } from '../lib/dinero';
import { feriadoDe, temporadaDe } from '../lib/feriados';
import { cubre, etiquetaHabitaciones, nochesDe, ocupadasEn, sumarDias } from '../lib/reservas';
import { FormularioReserva } from '../componentes/FormularioReserva';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function diasDelMes(mes: string): string[] {
  const anio = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7));
  const n = new Date(anio, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
}

export function Calendario() {
  const hoy = hoyISO();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [diaActivo, setDiaActivo] = useState(hoy);
  const [form, setForm] = useState<Partial<Reserva> | null>(null);

  const reservas = useLiveQuery(() => db.reservas.toArray()) ?? [];
  const habitaciones = useLiveQuery(() => db.habitaciones.toArray()) ?? [];

  const dias = diasDelMes(mes);
  const primerDiaSemana = (new Date(`${dias[0]}T00:00:00`).getDay() + 6) % 7; // lunes = 0
  const delDia = reservas.filter((r) => cubre(r, diaActivo) || r.checkOut === diaActivo).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const feriadoActivo = feriadoDe(diaActivo);
  const temporada = temporadaDe(diaActivo);

  const cambiarMes = (delta: number) => {
    const d = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const cobrar = async (r: Reserva) => {
    if (!r.id) return;
    const monto = r.montoAcordado;
    if (monto <= 0) return window.alert('Primero pon el monto acordado en la reserva.');
    await db.ingresos.add({ fecha: hoy, numeroHabitacion: r.habitaciones[0] ?? null, huespedes: r.huespedes, noches: nochesDe(r), monto, canal: r.canal, notas: `Reserva de ${r.huesped}`, creadoEn: Date.now() });
    await db.reservas.update(r.id, { cobrada: true });
  };

  const borrar = async (id: number) => {
    if (!window.confirm('¿Borrar esta reserva?')) return;
    await db.reservas.delete(id);
  };

  if (form) return <FormularioReserva inicial={form} onGuardado={() => setForm(null)} onCancelar={() => setForm(null)} />;

  return (
    <div className="apilado">
      <div className="entre">
        <h1>Calendario</h1>
        <button className="btn-primario btn-chico" onClick={() => setForm({ checkIn: diaActivo, checkOut: sumarDias(diaActivo, 1) })}>+ Reserva</button>
      </div>

      <section className="tarjeta">
        <div className="entre" style={{ marginBottom: 10 }}>
          <button className="btn-secundario btn-chico" onClick={() => cambiarMes(-1)}>‹</button>
          <h2 style={{ textTransform: 'capitalize' }}>{MESES[Number(mes.slice(5, 7)) - 1]} {mes.slice(0, 4)}</h2>
          <button className="btn-secundario btn-chico" onClick={() => cambiarMes(1)}>›</button>
        </div>
        <div className="calendario">
          {DIAS.map((d) => <div key={d} className="dia-nombre">{d}</div>)}
          {Array.from({ length: primerDiaSemana }).map((_, i) => <div key={`v${i}`} />)}
          {dias.map((dia) => {
            const n = ocupadasEn(reservas, dia).size;
            const feriado = feriadoDe(dia);
            return (
              <button
                key={dia}
                type="button"
                className={`dia ${dia === hoy ? 'hoy' : ''} ${dia === diaActivo ? 'activo' : ''} ${feriado ? 'feriado' : ''}`}
                title={feriado ?? undefined}
                onClick={() => setDiaActivo(dia)}
              >
                <span>{Number(dia.slice(8, 10))}</span>
                <span className="puntos">{n > 0 ? `${n}/${habitaciones.length}` : feriado ? 'F' : ' '}</span>
              </button>
            );
          })}
        </div>
        <p className="texto-tenue" style={{ marginTop: 8 }}>Número = habitaciones ocupadas esa noche · F = feriado nacional</p>
      </section>

      <section className="tarjeta apilado-sm">
        <div className="entre">
          <h2>{diaActivo === hoy ? 'Hoy' : diaActivo}</h2>
          <span className={`pill ${temporada.nivel === 'alta' ? 'pill-coral' : temporada.nivel === 'media' ? 'pill-brand' : 'pill-gris'}`}>
            {feriadoActivo ?? temporada.etiqueta}
          </span>
        </div>
        {delDia.length === 0 && <p className="texto-suave">Sin reservas este día.</p>}
        <ul className="lista">
          {delDia.map((r) => (
            <li key={r.id} className="item" style={{ alignItems: 'flex-start' }}>
              <div>
                <p className="item-titulo">{r.huesped} {r.cobrada && <span className="pill pill-brand">Cobrada</span>}</p>
                <p className="item-detalle">{etiquetaHabitaciones(r.habitaciones)} · {r.checkIn} → {r.checkOut} ({nochesDe(r)} noche(s)) · {r.huespedes} pax · {r.canal}</p>
                {r.montoAcordado > 0 && <p className="item-detalle">Acordado: {fmtUsd(r.montoAcordado)}</p>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {!r.cobrada && <button className="btn-primario btn-chico" onClick={() => cobrar(r)}>Cobrar</button>}
                <button className="btn-secundario btn-chico" onClick={() => setForm(r)}>Editar</button>
                <button className="btn-secundario btn-chico" onClick={() => borrar(r.id!)}>Borrar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
