import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { aplicarTema, preferenciaTema, type PreferenciaTema } from '../lib/tema';
import { enlaceMapa, ubicacionActual, type Coordenadas } from '../lib/ubicacion';
import { compartirArchivo, compartirTexto } from '../lib/compartir';

const TEMAS: { id: PreferenciaTema; etiqueta: string }[] = [
  { id: 'auto', etiqueta: 'Auto (oscuro de noche)' },
  { id: 'claro', etiqueta: 'Claro' },
  { id: 'oscuro', etiqueta: 'Oscuro' },
];

export function Negocio() {
  const [tema, setTema] = useState<PreferenciaTema>(preferenciaTema());
  const [mensaje, setMensaje] = useState('');
  const ubicacion = useLiveQuery(() => db.ajustes.get('ubicacion'))?.valor as Coordenadas | undefined;

  const elegirTema = (p: PreferenciaTema) => { setTema(p); aplicarTema(p); };

  const guardarUbicacion = async () => {
    setMensaje('Obteniendo ubicación…');
    try {
      const c = await ubicacionActual();
      await db.ajustes.put({ clave: 'ubicacion', valor: c });
      setMensaje('Ubicación guardada.');
    } catch {
      setMensaje('No se pudo obtener la ubicación. Revisa el permiso de ubicación del teléfono.');
    }
  };

  const compartirUbicacion = () => {
    if (!ubicacion) return;
    void compartirTexto('Ubicación Casa Mamá Emma', `Casa Mamá Emma, Baños de Agua Santa. Cómo llegar: ${enlaceMapa(ubicacion)}`);
  };

  const respaldar = async () => {
    const [gastos, ingresos, mantenimientos, habitaciones, reservas, obligaciones, registros, ajustes] = await Promise.all([
      db.gastos.toArray(), db.ingresos.toArray(), db.mantenimientos.toArray(), db.habitaciones.toArray(),
      db.reservas.toArray(), db.obligaciones.toArray(), db.registros.toArray(), db.ajustes.toArray(),
    ]);
    const respaldo = { version: 3, fecha: new Date().toISOString(), gastos, ingresos, mantenimientos, habitaciones, reservas, obligaciones, registros, ajustes };
    const blob = new Blob([JSON.stringify(respaldo)], { type: 'application/json' });
    await compartirArchivo(`respaldo-casa-mama-emma-${respaldo.fecha.slice(0, 10)}.json`, blob, 'Respaldo Casa Mamá Emma');
  };

  const restaurar = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!window.confirm('Esto REEMPLAZA todos los datos de este teléfono por los del respaldo. ¿Continuar?')) return;
      try {
        const r = JSON.parse(await file.text());
        await db.transaction('rw', [db.gastos, db.ingresos, db.mantenimientos, db.habitaciones, db.reservas, db.obligaciones, db.registros, db.ajustes], async () => {
          for (const tabla of ['gastos', 'ingresos', 'mantenimientos', 'habitaciones', 'reservas', 'obligaciones', 'registros', 'ajustes']) {
            await db.table(tabla).clear();
            if (Array.isArray(r[tabla])) await db.table(tabla).bulkAdd(r[tabla]);
          }
        });
        setMensaje('Respaldo restaurado.');
      } catch {
        setMensaje('El archivo no es un respaldo válido.');
      }
    };
    input.click();
  };

  return (
    <div className="apilado">
      <h1>Negocio y app</h1>
      {mensaje && <p className="tarjeta" style={{ padding: 12, fontSize: 14 }}>{mensaje}</p>}

      <section className="tarjeta">
        <h2>Apariencia</h2>
        <p className="texto-suave" style={{ margin: '4px 0 10px' }}>Colores claros de día y oscuros de noche, como el sistema de la PC.</p>
        <div className="chips">
          {TEMAS.map((t) => <button key={t.id} className={`chip ${tema === t.id ? 'activo' : ''}`} onClick={() => elegirTema(t.id)}>{t.etiqueta}</button>)}
        </div>
      </section>

      <section className="tarjeta">
        <h2>Ubicación del hospedaje</h2>
        <p className="texto-suave" style={{ margin: '4px 0 10px' }}>Guárdala una vez estando en Casa Mamá Emma; luego envíala a los huéspedes por WhatsApp con un toque.</p>
        {ubicacion && <p className="texto-suave" style={{ marginBottom: 10 }}>Guardada: {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}</p>}
        <div className="fila">
          <button className="btn-secundario btn-bloque" onClick={guardarUbicacion}>{ubicacion ? 'Actualizar ubicación' : 'Guardar mi ubicación'}</button>
          <button className="btn-primario btn-bloque" disabled={!ubicacion} onClick={compartirUbicacion}>Compartir cómo llegar</button>
        </div>
        {ubicacion && <a className="volver" style={{ display: 'inline-block', marginTop: 10 }} href={enlaceMapa(ubicacion)} target="_blank" rel="noreferrer">Abrir en Google Maps</a>}
      </section>

      <section className="tarjeta">
        <h2>Respaldo de datos</h2>
        <p className="texto-suave" style={{ margin: '4px 0 10px' }}>Los datos viven solo en este teléfono. Haz un respaldo seguido (a Drive, WhatsApp o correo) y restáuralo en otro teléfono.</p>
        <div className="fila">
          <button className="btn-primario btn-bloque" onClick={respaldar}>Hacer respaldo</button>
          <button className="btn-secundario btn-bloque" onClick={restaurar}>Restaurar respaldo</button>
        </div>
      </section>
    </div>
  );
}
