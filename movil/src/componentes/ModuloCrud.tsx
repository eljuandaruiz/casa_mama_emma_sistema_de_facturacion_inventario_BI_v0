import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hoyISO, type Registro } from '../lib/db';
import type { Campo, Datos, DefinicionModulo } from '../lib/modulos';
import { fmtUsd } from '../lib/dinero';
import { tomarFoto } from '../lib/foto';
import { telefonoInternacional } from '../lib/ubicacion';
import { borrarBorrador, guardarBorrador, leerBorrador } from '../lib/navegacion';

interface Borrador {
  id: number | null;
  datos: Datos;
}

function datosIniciales(campos: Campo[]): Datos {
  const d: Datos = {};
  for (const c of campos) {
    if (c.tipo === 'fecha') d[c.clave] = hoyISO();
    else if (c.tipo === 'select') d[c.clave] = c.opciones?.[0] ?? '';
    else if (c.tipo === 'si_no') d[c.clave] = false;
    else d[c.clave] = '';
  }
  return d;
}

/** Módulo genérico: lista con búsqueda, formulario según definición, fotos, llamadas y WhatsApp. */
export function ModuloCrud({ def }: { def: DefinicionModulo }) {
  const registros = useLiveQuery(() => db.registros.where('modulo').equals(def.id).toArray(), [def.id]) ?? [];
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [datos, setDatos] = useState<Datos>({});
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');

  const clave = `modulo_${def.id}`;

  // Si Android reinició la pantalla con el formulario abierto, lo recupera.
  useEffect(() => {
    const b = leerBorrador<Borrador>(clave);
    if (b?.datos) {
      setDatos(b.datos);
      setEditandoId(b.id);
      setNuevo(true);
    }
  }, [clave]);

  useEffect(() => {
    if (nuevo) guardarBorrador(clave, { id: editandoId, datos } satisfies Borrador);
  }, [nuevo, datos, editandoId, clave]);

  const abrirNuevo = () => { setDatos(datosIniciales(def.campos)); setEditandoId(null); setNuevo(true); setError(''); };
  const abrirEditar = (r: Registro) => { setDatos({ ...datosIniciales(def.campos), ...r.datos }); setEditandoId(r.id ?? null); setNuevo(true); setError(''); };
  const cerrar = () => { setNuevo(false); setEditandoId(null); borrarBorrador(clave); };

  const guardar = async () => {
    const limpio: Datos = {};
    for (const c of def.campos) {
      const v = datos[c.clave];
      if (c.tipo === 'numero' || c.tipo === 'dinero') limpio[c.clave] = v === '' || v === undefined ? 0 : Number(v) || 0;
      else if (c.tipo === 'si_no') limpio[c.clave] = Boolean(v);
      else limpio[c.clave] = typeof v === 'string' ? v.trim() : v ?? '';
      if (c.requerido && !limpio[c.clave]) return setError(`Falta: ${c.etiqueta}.`);
    }
    if (editandoId) await db.registros.update(editandoId, { datos: limpio });
    else await db.registros.add({ modulo: def.id, datos: limpio, creadoEn: Date.now() });
    cerrar();
  };

  const borrar = async (id: number) => {
    if (!window.confirm(`¿Borrar este ${def.singular}?`)) return;
    await db.registros.delete(id);
    cerrar();
  };

  const ponerFoto = async (campo: string) => {
    setError('');
    const img = await tomarFoto();
    if (img) setDatos((d) => ({ ...d, [campo]: img }));
    else setError('No se agregó ninguna foto. Si no se abrió la galería, revisa los permisos de la app en Ajustes de Android.');
  };

  const filtrados = registros
    .map((r) => ({ r, s: def.resumen(r.datos) }))
    .filter(({ s }) => !busqueda || `${s.titulo} ${s.detalle}`.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => b.r.creadoEn - a.r.creadoEn);
  const campoTelefono = def.campos.find((c) => c.tipo === 'telefono')?.clave;

  if (nuevo) {
    return (
      <section className="tarjeta">
        <h2>{editandoId ? `Editar ${def.singular}` : `Nuevo ${def.singular}`}</h2>
        {def.campos.map((c) => (
          <div key={c.clave}>
            {c.tipo !== 'si_no' && <label className="etiqueta">{c.etiqueta}{c.requerido ? ' *' : ''}</label>}
            {c.tipo === 'texto' && <input className="campo" value={String(datos[c.clave] ?? '')} onChange={(e) => setDatos({ ...datos, [c.clave]: e.target.value })} />}
            {c.tipo === 'telefono' && <input className="campo" type="tel" inputMode="tel" value={String(datos[c.clave] ?? '')} onChange={(e) => setDatos({ ...datos, [c.clave]: e.target.value })} placeholder="09xxxxxxxx" />}
            {c.tipo === 'textoLargo' && <textarea className="campo" value={String(datos[c.clave] ?? '')} onChange={(e) => setDatos({ ...datos, [c.clave]: e.target.value })} />}
            {(c.tipo === 'numero' || c.tipo === 'dinero') && <input className="campo" type="number" inputMode="decimal" value={String(datos[c.clave] ?? '')} onChange={(e) => setDatos({ ...datos, [c.clave]: e.target.value })} placeholder={c.tipo === 'dinero' ? '0.00' : '0'} />}
            {c.tipo === 'fecha' && <input className="campo" type="date" value={String(datos[c.clave] ?? '')} onChange={(e) => setDatos({ ...datos, [c.clave]: e.target.value })} />}
            {c.tipo === 'select' && (
              <select className="campo" value={String(datos[c.clave] ?? '')} onChange={(e) => setDatos({ ...datos, [c.clave]: e.target.value })}>
                {c.opciones?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {c.tipo === 'si_no' && (
              <label className="entre" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
                <input type="checkbox" style={{ width: 22, height: 22, minHeight: 0 }} checked={Boolean(datos[c.clave])} onChange={(e) => setDatos({ ...datos, [c.clave]: e.target.checked })} />
                {c.etiqueta}
              </label>
            )}
            {c.tipo === 'foto' && (
              <div>
                {datos[c.clave] ? (
                  <div className="miniaturas">
                    <div className="miniatura" style={{ width: 120, height: 120 }}>
                      <img src={String(datos[c.clave])} alt="" />
                      <button onClick={() => setDatos({ ...datos, [c.clave]: '' })}>✕</button>
                    </div>
                  </div>
                ) : null}
                <button type="button" className="btn-secundario btn-chico" style={{ marginTop: 6 }} onClick={() => ponerFoto(c.clave)}>
                  {datos[c.clave] ? 'Cambiar foto' : 'Agregar foto (cámara o galería)'}
                </button>
              </div>
            )}
          </div>
        ))}
        {error && <p style={{ color: 'var(--coral-600)', fontSize: 13, marginTop: 8 }}>{error}</p>}
        <div className="fila" style={{ marginTop: 14 }}>
          <button className="btn-secundario btn-bloque" onClick={cerrar}>Cancelar</button>
          <button className="btn-primario btn-bloque" onClick={guardar}>Guardar</button>
        </div>
        {editandoId && <button className="btn-peligro btn-bloque" style={{ marginTop: 10 }} onClick={() => borrar(editandoId)}>Borrar {def.singular}</button>}
      </section>
    );
  }

  return (
    <div className="apilado">
      <div className="entre">
        <h1>{def.titulo}</h1>
        <button className="btn-primario btn-chico" onClick={abrirNuevo}>+ Nuevo</button>
      </div>
      <p className="texto-suave">{def.descripcion}</p>
      {registros.length > 4 && <input className="campo" placeholder="Buscar…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />}
      <section className="tarjeta">
        {filtrados.length === 0 && <p className="texto-suave">Sin {def.titulo.toLowerCase()} todavía. Toca "+ Nuevo".</p>}
        <ul className="lista">
          {filtrados.map(({ r, s }) => {
            const tel = campoTelefono ? String(r.datos[campoTelefono] ?? '') : '';
            const foto = String(r.datos.foto ?? '');
            return (
              <li key={r.id} className="item" style={{ alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1, minWidth: 0 }} onClick={() => abrirEditar(r)}>
                  {foto && <img src={foto} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
                  <div style={{ minWidth: 0 }}>
                    <p className="item-titulo">{s.titulo} {s.alerta && <span className="pill pill-coral">{s.alerta}</span>}</p>
                    <p className="item-detalle">{s.detalle}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  {s.monto !== undefined && <span style={{ fontWeight: 700 }}>{fmtUsd(s.monto)}</span>}
                  {tel && (
                    <div className="chips">
                      <a className="chip" href={`tel:${tel}`}>Llamar</a>
                      <a className="chip" href={`https://wa.me/${telefonoInternacional(tel)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
