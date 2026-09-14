import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hoyISO } from '../lib/db';
import { diasRestantes, nivelAlerta, siguienteVencimiento, textoDias, type Recurrencia } from '../lib/obligaciones';

const RECURRENCIAS: Recurrencia[] = ['MENSUAL', 'SEMESTRAL', 'ANUAL', 'UNICA'];

export function Obligaciones() {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: '', entidad: '', recurrencia: 'ANUAL' as Recurrencia, proximoVencimiento: hoyISO() });
  const obligaciones = useLiveQuery(() => db.obligaciones.filter((o) => o.activa).sortBy('proximoVencimiento')) ?? [];

  const marcarPagada = async (id: number, fecha: string, recurrencia: Recurrencia) => {
    if (recurrencia === 'UNICA') await db.obligaciones.update(id, { ultimoPago: hoyISO(), activa: false });
    else await db.obligaciones.update(id, { ultimoPago: hoyISO(), proximoVencimiento: siguienteVencimiento(fecha, recurrencia) });
  };

  const guardar = async () => {
    if (!form.nombre.trim()) return;
    await db.obligaciones.add({ nombre: form.nombre.trim(), tipo: 'OTRO', entidad: form.entidad.trim(), recurrencia: form.recurrencia, proximoVencimiento: form.proximoVencimiento, notas: '', activa: true, ultimoPago: null });
    setForm({ nombre: '', entidad: '', recurrencia: 'ANUAL', proximoVencimiento: hoyISO() });
    setAbierto(false);
  };

  return (
    <div className="apilado">
      <div className="entre">
        <h1>Obligaciones</h1>
        <button className="btn-primario btn-chico" onClick={() => setAbierto((v) => !v)}>{abierto ? 'Cerrar' : '+ Nueva'}</button>
      </div>
      <p className="texto-suave">Impuestos, patentes y permisos. Se avisa desde 30 días antes del vencimiento; al marcar "Pagada" pasa al siguiente periodo.</p>

      {abierto && (
        <section className="tarjeta">
          <label className="etiqueta">Nombre</label>
          <input className="campo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej.: Declaración IVA" />
          <label className="etiqueta">Entidad</label>
          <input className="campo" value={form.entidad} onChange={(e) => setForm({ ...form, entidad: e.target.value })} placeholder="SRI, Municipio, Bomberos…" />
          <div className="fila">
            <div>
              <label className="etiqueta">Se repite</label>
              <select className="campo" value={form.recurrencia} onChange={(e) => setForm({ ...form, recurrencia: e.target.value as Recurrencia })}>
                {RECURRENCIAS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta">Próximo vencimiento</label>
              <input type="date" className="campo" value={form.proximoVencimiento} onChange={(e) => setForm({ ...form, proximoVencimiento: e.target.value })} />
            </div>
          </div>
          <button className="btn-primario btn-bloque" style={{ marginTop: 12 }} onClick={guardar}>Guardar</button>
        </section>
      )}

      <div className="apilado-sm">
        {obligaciones.map((o) => {
          const dias = diasRestantes(o.proximoVencimiento);
          const nivel = nivelAlerta(dias);
          return (
            <div key={o.id} className={`tarjeta ${nivel !== 'ok' ? `aviso aviso-${nivel}` : ''}`}>
              <div className="entre">
                <div>
                  <p style={{ fontWeight: 600 }}>{o.nombre}</p>
                  <p className="item-detalle" style={{ opacity: 0.85 }}>{o.entidad || 'Sin entidad'} · {o.recurrencia} · Vence el {o.proximoVencimiento}</p>
                  {o.ultimoPago && <p className="item-detalle" style={{ opacity: 0.85 }}>Último pago: {o.ultimoPago}</p>}
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{textoDias(dias)}</span>
              </div>
              <button className="btn-secundario btn-chico" style={{ marginTop: 10 }} onClick={() => marcarPagada(o.id!, o.proximoVencimiento, o.recurrencia)}>
                Marcar pagada
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
