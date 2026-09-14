import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hoyISO, AREAS, type FotoTrabajo } from '../lib/db';
import { fmtUsd } from '../lib/dinero';
import { comprimirImagen } from '../lib/imagen';
import { generarPdfMantenimiento } from '../lib/pdfMantenimiento';
import { compartirArchivo } from '../lib/compartir';

const VACIO = { titulo: '', area: AREAS[0], descripcion: '', fecha: hoyISO(), costoMateriales: '', costoManoObra: '' };

export function Mantenimiento() {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [fotos, setFotos] = useState<FotoTrabajo[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const trabajos = useLiveQuery(() => db.mantenimientos.orderBy('fecha').reverse().toArray()) ?? [];

  const agregarFoto = async (file: File | undefined) => {
    if (!file) return;
    const imagen = await comprimirImagen(file, 900, 0.7);
    setFotos((f) => [...f, { imagen, descripcion: '' }]);
  };

  const guardar = async () => {
    if (!form.titulo.trim()) return;
    await db.mantenimientos.add({
      titulo: form.titulo.trim(),
      area: form.area,
      descripcion: form.descripcion.trim(),
      fecha: form.fecha,
      costoMateriales: Number(form.costoMateriales) || 0,
      costoManoObra: Number(form.costoManoObra) || 0,
      fotos,
      creadoEn: Date.now(),
    });
    setForm(VACIO);
    setFotos([]);
    setAbierto(false);
  };

  const borrar = async (id: number) => {
    if (!window.confirm('¿Borrar este trabajo?')) return;
    await db.mantenimientos.delete(id);
  };

  const pdfYCompartir = async (id: number) => {
    const m = await db.mantenimientos.get(id);
    if (!m) return;
    setOcupado(true);
    try {
      const blob = await generarPdfMantenimiento(m);
      await compartirArchivo(`mantenimiento-${m.fecha}-${m.titulo.slice(0, 20)}.pdf`, blob, m.titulo);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div>
      {!abierto && <button className="btn btn-primario btn-bloque" style={{ marginBottom: 12 }} onClick={() => setAbierto(true)}>+ Nuevo trabajo</button>}

      {abierto && (
        <section className="tarjeta">
          <p className="etiqueta">Nuevo trabajo de mantenimiento</p>
          <label className="etiqueta">Título</label>
          <input className="campo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej.: Pintura habitación 4" />
          <div className="fila">
            <div>
              <label className="etiqueta">Área</label>
              <select className="campo" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta">Fecha</label>
              <input type="date" className="campo" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
          </div>
          <label className="etiqueta">Descripción</label>
          <textarea className="campo" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          <div className="fila">
            <div>
              <label className="etiqueta">Costo materiales</label>
              <input type="number" inputMode="decimal" className="campo" value={form.costoMateriales} onChange={(e) => setForm({ ...form, costoMateriales: e.target.value })} />
            </div>
            <div>
              <label className="etiqueta">Costo mano de obra</label>
              <input type="number" inputMode="decimal" className="campo" value={form.costoManoObra} onChange={(e) => setForm({ ...form, costoManoObra: e.target.value })} />
            </div>
          </div>
          <label className="etiqueta">Fotos</label>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => void agregarFoto(e.target.files?.[0])} />
          {fotos.length > 0 && (
            <div className="miniaturas">
              {fotos.map((f, idx) => (
                <div key={idx} className="miniatura">
                  <img src={f.imagen} alt="" />
                  <button onClick={() => setFotos((fs) => fs.filter((_, i) => i !== idx))}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="fila" style={{ marginTop: 10 }}>
            <button className="btn btn-secundario btn-bloque" onClick={() => { setAbierto(false); setForm(VACIO); setFotos([]); }}>Cancelar</button>
            <button className="btn btn-primario btn-bloque" onClick={guardar}>Guardar</button>
          </div>
        </section>
      )}

      <section className="tarjeta">
        <p className="etiqueta">Trabajos registrados</p>
        {trabajos.length === 0 && <p style={{ fontSize: 13, color: '#78716c' }}>Sin trabajos todavía.</p>}
        <ul className="lista">
          {trabajos.map((t) => (
            <li key={t.id} className="item" style={{ alignItems: 'flex-start' }}>
              <div>
                <p className="item-titulo">{t.titulo}</p>
                <p className="item-detalle">{t.area} · {t.fecha} · {fmtUsd(t.costoMateriales + t.costoManoObra)}</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secundario" style={{ padding: '4px 8px', fontSize: 12 }} disabled={ocupado} onClick={() => pdfYCompartir(t.id!)}>PDF</button>
                <button className="btn btn-secundario" style={{ padding: '4px 8px' }} onClick={() => borrar(t.id!)}>✕</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
