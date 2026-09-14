import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Habitacion } from '../lib/db';

type Campo = 'nombre' | 'descripcionCamas' | 'capacidad' | 'precioHabitacion' | 'precioPersona';

export function Habitaciones() {
  const habitaciones = useLiveQuery(() => db.habitaciones.orderBy('numero').toArray()) ?? [];

  const guardar = async (h: Habitacion, campo: Campo, valor: string) => {
    if (campo === 'nombre' || campo === 'descripcionCamas') {
      if (valor.trim()) await db.habitaciones.update(h.id!, { [campo]: valor.trim() });
      return;
    }
    const n = Number(valor);
    if (!Number.isNaN(n) && n >= 0) await db.habitaciones.update(h.id!, { [campo]: n });
  };

  return (
    <div className="apilado">
      <h1>Habitaciones</h1>
      <p className="texto-suave">Nombre, camas, capacidad y tarifas. Los cambios se guardan al salir de cada campo.</p>
      {habitaciones.map((h) => (
        <section key={h.id} className="tarjeta">
          <div className="entre">
            <span className="badge-numero">{h.numero}</span>
            <input className="campo" style={{ flex: 1 }} defaultValue={h.nombre} onBlur={(e) => guardar(h, 'nombre', e.target.value)} />
          </div>
          <label className="etiqueta">Camas</label>
          <input className="campo" defaultValue={h.descripcionCamas} onBlur={(e) => guardar(h, 'descripcionCamas', e.target.value)} />
          <div className="fila">
            <div>
              <label className="etiqueta">Capacidad</label>
              <input type="number" className="campo" defaultValue={h.capacidad} onBlur={(e) => guardar(h, 'capacidad', e.target.value)} />
            </div>
            <div>
              <label className="etiqueta">Por habitación/noche</label>
              <input type="number" inputMode="decimal" className="campo" defaultValue={h.precioHabitacion} onBlur={(e) => guardar(h, 'precioHabitacion', e.target.value)} />
            </div>
            <div>
              <label className="etiqueta">Por persona/noche</label>
              <input type="number" inputMode="decimal" className="campo" defaultValue={h.precioPersona} onBlur={(e) => guardar(h, 'precioPersona', e.target.value)} />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
