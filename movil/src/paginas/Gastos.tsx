import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hoyISO, CATEGORIAS_GASTO, type Ingreso } from '../lib/db';
import { fmtUsd } from '../lib/dinero';

const CANALES: Ingreso['canal'][] = ['DIRECTO', 'AIRBNB', 'BOOKING', 'OTRO'];

export function Gastos() {
  const [tipo, setTipo] = useState<'gasto' | 'ingreso'>('gasto');
  const [abierto, setAbierto] = useState(false);
  const [gasto, setGasto] = useState({ fecha: hoyISO(), categoria: CATEGORIAS_GASTO[0], descripcion: '', monto: '' });
  const [ingreso, setIngreso] = useState({ fecha: hoyISO(), numeroHabitacion: '', huespedes: '1', noches: '1', monto: '', canal: 'DIRECTO' as Ingreso['canal'], notas: '' });

  const gastos = useLiveQuery(() => db.gastos.orderBy('fecha').reverse().toArray()) ?? [];
  const ingresos = useLiveQuery(() => db.ingresos.orderBy('fecha').reverse().toArray()) ?? [];

  const movimientos = [
    ...ingresos.map((i) => ({ id: i.id!, tabla: 'ingresos' as const, fecha: i.fecha, texto: `Ingreso · ${i.canal}${i.notas ? ' · ' + i.notas : ''}`, monto: i.monto, esIngreso: true })),
    ...gastos.map((g) => ({ id: g.id!, tabla: 'gastos' as const, fecha: g.fecha, texto: `${g.categoria}${g.descripcion ? ' · ' + g.descripcion : ''}`, monto: g.monto, esIngreso: false })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const guardarGasto = async () => {
    const monto = Number(gasto.monto);
    if (!monto || monto <= 0) return;
    await db.gastos.add({ fecha: gasto.fecha, categoria: gasto.categoria, descripcion: gasto.descripcion.trim(), monto, creadoEn: Date.now() });
    setGasto({ fecha: hoyISO(), categoria: CATEGORIAS_GASTO[0], descripcion: '', monto: '' });
    setAbierto(false);
  };

  const guardarIngreso = async () => {
    const monto = Number(ingreso.monto);
    if (!monto || monto <= 0) return;
    await db.ingresos.add({
      fecha: ingreso.fecha,
      numeroHabitacion: ingreso.numeroHabitacion ? Number(ingreso.numeroHabitacion) : null,
      huespedes: Number(ingreso.huespedes) || 1,
      noches: Number(ingreso.noches) || 1,
      monto,
      canal: ingreso.canal,
      notas: ingreso.notas.trim(),
      creadoEn: Date.now(),
    });
    setIngreso({ fecha: hoyISO(), numeroHabitacion: '', huespedes: '1', noches: '1', monto: '', canal: 'DIRECTO', notas: '' });
    setAbierto(false);
  };

  const borrar = async (tabla: 'gastos' | 'ingresos', id: number) => {
    if (!window.confirm('¿Borrar este registro?')) return;
    await db[tabla].delete(id);
  };

  return (
    <div>
      {!abierto && (
        <div className="fila" style={{ marginBottom: 12 }}>
          <button className="btn btn-peligro btn-bloque" onClick={() => { setTipo('gasto'); setAbierto(true); }}>+ Gasto</button>
          <button className="btn btn-primario btn-bloque" onClick={() => { setTipo('ingreso'); setAbierto(true); }}>+ Ingreso</button>
        </div>
      )}

      {abierto && tipo === 'gasto' && (
        <section className="tarjeta">
          <p className="etiqueta">Nuevo gasto</p>
          <div className="fila">
            <div>
              <label className="etiqueta">Fecha</label>
              <input type="date" className="campo" value={gasto.fecha} onChange={(e) => setGasto({ ...gasto, fecha: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Monto</label>
              <input type="number" inputMode="decimal" className="campo" value={gasto.monto} onChange={(e) => setGasto({ ...gasto, monto: e.target.value })} placeholder="0.00" />
            </div>
          </div>
          <label className="etiqueta">Categoría</label>
          <select className="campo" value={gasto.categoria} onChange={(e) => setGasto({ ...gasto, categoria: e.target.value })}>
            {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="etiqueta">Descripción (opcional)</label>
          <input className="campo" value={gasto.descripcion} onChange={(e) => setGasto({ ...gasto, descripcion: e.target.value })} />
          <div className="fila" style={{ marginTop: 10 }}>
            <button className="btn btn-secundario btn-bloque" onClick={() => setAbierto(false)}>Cancelar</button>
            <button className="btn btn-primario btn-bloque" onClick={guardarGasto}>Guardar</button>
          </div>
        </section>
      )}

      {abierto && tipo === 'ingreso' && (
        <section className="tarjeta">
          <p className="etiqueta">Nuevo ingreso</p>
          <div className="fila">
            <div>
              <label className="etiqueta">Fecha</label>
              <input type="date" className="campo" value={ingreso.fecha} onChange={(e) => setIngreso({ ...ingreso, fecha: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Monto recibido</label>
              <input type="number" inputMode="decimal" className="campo" value={ingreso.monto} onChange={(e) => setIngreso({ ...ingreso, monto: e.target.value })} placeholder="0.00" />
            </div>
          </div>
          <div className="fila">
            <div>
              <label className="etiqueta">Habitación (opcional)</label>
              <input type="number" className="campo" value={ingreso.numeroHabitacion} onChange={(e) => setIngreso({ ...ingreso, numeroHabitacion: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Huéspedes</label>
              <input type="number" className="campo" value={ingreso.huespedes} onChange={(e) => setIngreso({ ...ingreso, huespedes: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Noches</label>
              <input type="number" className="campo" value={ingreso.noches} onChange={(e) => setIngreso({ ...ingreso, noches: e.target.value })} />
            </div>
          </div>
          <label className="etiqueta">Canal</label>
          <select className="campo" value={ingreso.canal} onChange={(e) => setIngreso({ ...ingreso, canal: e.target.value as Ingreso['canal'] })}>
            {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="etiqueta">Notas (opcional)</label>
          <input className="campo" value={ingreso.notas} onChange={(e) => setIngreso({ ...ingreso, notas: e.target.value })} />
          <div className="fila" style={{ marginTop: 10 }}>
            <button className="btn btn-secundario btn-bloque" onClick={() => setAbierto(false)}>Cancelar</button>
            <button className="btn btn-primario btn-bloque" onClick={guardarIngreso}>Guardar</button>
          </div>
        </section>
      )}

      <section className="tarjeta">
        <p className="etiqueta">Historial</p>
        {movimientos.length === 0 && <p style={{ fontSize: 13, color: '#78716c' }}>Sin registros todavía.</p>}
        <ul className="lista">
          {movimientos.map((m) => (
            <li key={`${m.tabla}-${m.id}`} className="item">
              <div>
                <p className="item-titulo">{m.texto}</p>
                <p className="item-detalle">{m.fecha}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={m.esIngreso ? 'monto-ingreso' : 'monto-gasto'}>{m.esIngreso ? '+' : '-'}{fmtUsd(m.monto)}</span>
                <button className="btn btn-secundario" style={{ padding: '4px 8px' }} onClick={() => borrar(m.tabla, m.id)}>✕</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
