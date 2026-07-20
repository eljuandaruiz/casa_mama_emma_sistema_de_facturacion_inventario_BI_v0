'use client';

/**
 * Módulo de mantenimiento: formulario para documentar un trabajo (6–8 fotos
 * con descripción, costos itemizados, metadatos) y generar el PDF dúplex A4.
 * Incluye la lista de trabajos previos con enlace al PDF.
 */
import { useCallback, useEffect, useState } from 'react';
import { comprimirImagen } from '@/lib/imagen';
import { fmtUsd } from '@/lib/money';
import { AREAS } from '@/lib/areas';
import { CATEGORIAS_MANTENIMIENTO, categoriaMantenimiento } from '@/lib/categoriasMantenimiento';
import { BotonCompartir } from '@/components/BotonCompartir';

interface FotoUI {
  imagen: string; // data URI
  descripcion: string;
  fase: 'ANTES' | 'DESPUES';
}
interface ItemUI {
  concepto: string;
  tipo: 'MATERIAL' | 'MANO_OBRA';
  monto: string;
}
interface TrabajoLista {
  id: number;
  titulo: string;
  fecha: string;
  categoria: string;
  tipo: string;
  costoTotal: number;
  responsable: string | null;
  nFotos: number;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

const META_VACIO = {
  titulo: '',
  descripcionGeneral: '',
  area: 'GENERAL', // área física del trabajo
  categoria: 'GENERAL', // categoría con color
  tipo: 'MEJORA' as 'DANO' | 'MEJORA', // módulo unificado daño/mejora
  fecha: hoyISO(), // fecha del reporte (editable)
  fechaInicio: hoyISO(),
  fechaFin: hoyISO(),
  totalDias: '1',
  totalHoras: '',
  tiempoInvertido: '',
  responsable: '',
  responsableTel: '',
  supervisor: '',
  supervisorTel: '',
  numerosFactura: '',
  inventarioConsumido: '',
  materialSobrante: '',
};

interface Contacto {
  id: number;
  nombre: string;
  telefono: string | null;
  oficio: string | null;
}

export function PanelMantenimiento() {
  const [trabajos, setTrabajos] = useState<TrabajoLista[]>([]);
  const [meta, setMeta] = useState({ ...META_VACIO });
  const [fotos, setFotos] = useState<FotoUI[]>([]);
  const [items, setItems] = useState<ItemUI[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState<number | null>(null);

  const [contactos, setContactos] = useState<Contacto[]>([]);
  // Materiales del inventario usados en el trabajo (se descuentan del stock).
  const [articulosInv, setArticulosInv] = useState<{ id: number; nombre: string; stock: number; unidad: string }[]>([]);
  const [materialesUsados, setMaterialesUsados] = useState<{ articuloId: string; cantidad: string }[]>([]);

  const cargar = useCallback(() => {
    void fetch('/api/mantenimiento').then((r) => r.json()).then(setTrabajos);
    void fetch('/api/contactos').then((r) => r.json()).then(setContactos);
    void fetch('/api/inventario').then((r) => r.json()).then(setArticulosInv);
  }, []);
  useEffect(() => cargar(), [cargar]);

  const setMetaCampo =
    (k: keyof typeof meta) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setMeta((prev) => ({ ...prev, [k]: e.target.value }));

  // Al escribir/elegir un nombre de contacto, autocompleta su teléfono guardado.
  const elegirContacto = (campoNombre: 'responsable' | 'supervisor', valor: string) => {
    const campoTel = campoNombre === 'responsable' ? 'responsableTel' : 'supervisorTel';
    const c = contactos.find((x) => x.nombre === valor);
    setMeta((prev) => ({
      ...prev,
      [campoNombre]: valor,
      ...(c?.telefono ? { [campoTel]: c.telefono } : {}),
    }));
  };

  // Sube fotos asignándoles una FASE (Antes/Después). Sin límite de 8: la
  // paginación del PDF es dinámica.
  const subirFotos = async (files: FileList | null, fase: 'ANTES' | 'DESPUES') => {
    if (!files) return;
    setError('');
    setSubiendo(true);
    try {
      const nuevas: FotoUI[] = [];
      for (const f of Array.from(files).slice(0, 40)) {
        const imagen = await comprimirImagen(f);
        nuevas.push({ imagen, descripcion: '', fase });
      }
      setFotos((prev) => [...prev, ...nuevas]);
    } catch {
      setError('No se pudo procesar alguna imagen.');
    } finally {
      setSubiendo(false);
    }
  };

  const costoTotal = items.reduce((a, i) => a + (Number(i.monto) || 0), 0);

  const guardar = async () => {
    setError('');
    if (fotos.length < 1) return setError('Sube al menos una foto.');
    if (!meta.titulo.trim()) return setError('Ponle un título al trabajo.');
    setGuardando(true);
    try {
      const res = await fetch('/api/mantenimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...meta,
          totalDias: meta.totalDias ? Number(meta.totalDias) : undefined,
          totalHoras: meta.totalHoras ? Number(meta.totalHoras) : undefined,
          items: items
            .filter((i) => i.concepto.trim() && Number(i.monto) > 0)
            .map((i) => ({ concepto: i.concepto.trim(), tipo: i.tipo, monto: Number(i.monto) })),
          // Las fotos llevan su fase (Antes/Después); el orden se asigna aquí.
          fotos: fotos.map((f, orden) => ({ orden, fase: f.fase, imagen: f.imagen, descripcion: f.descripcion })),
          materialesUsados: materialesUsados
            .filter((m) => m.articuloId && Number(m.cantidad) > 0)
            .map((m) => ({ articuloId: Number(m.articuloId), cantidad: Number(m.cantidad) })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');
      setOk(json.id);
      // Reset del formulario
      setMeta({ ...META_VACIO });
      setFotos([]);
      setItems([]);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Mantenimiento y mejoras</h1>
        <p className="text-sm text-slate-500">
          Documenta reparaciones con fotos y costos, y genera un PDF A4 a doble cara.
        </p>
      </header>

      {ok && (
        <div className="tarjeta flex items-center justify-between bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">✅ Trabajo guardado.</p>
          <a href={`/api/mantenimiento/${ok}/pdf`} target="_blank" className="btn-primario text-sm">
            Ver PDF dúplex
          </a>
        </div>
      )}

      {/* ---------- Datos generales ---------- */}
      <section className="tarjeta space-y-3 p-4 md:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label className="etiqueta" htmlFor="titulo">Título del trabajo *</label>
            <input id="titulo" className="campo" placeholder="Ej.: Reparación de tubería baño Hab. 4" value={meta.titulo} onChange={setMetaCampo('titulo')} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="fecha">Fecha</label>
            <input id="fecha" type="date" className="campo" value={meta.fecha} onChange={setMetaCampo('fecha')} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="area">Área física</label>
            <select id="area" className="campo" value={meta.area} onChange={setMetaCampo('area')}>
              {AREAS.map((a) => <option key={a.valor} value={a.valor}>{a.etiqueta}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="tipo">Tipo de trabajo</label>
            <select id="tipo" className="campo" value={meta.tipo} onChange={setMetaCampo('tipo')}>
              <option value="MEJORA">Mejora</option>
              <option value="DANO">Reparación de daño</option>
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="categoria">Categoría (color)</label>
            <select
              id="categoria"
              className="campo"
              value={meta.categoria}
              onChange={setMetaCampo('categoria')}
              // Borde del color de la categoría, como pista visual.
              style={{ borderLeft: `6px solid ${categoriaMantenimiento(meta.categoria).color}` }}
            >
              {CATEGORIAS_MANTENIMIENTO.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
            </select>
          </div>
        </div>

        {/* Seguimiento temporal: inicio, fin, días y horas. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <label className="etiqueta">Inicio</label>
            <input type="date" className="campo" value={meta.fechaInicio} onChange={setMetaCampo('fechaInicio')} />
          </div>
          <div>
            <label className="etiqueta">Fin</label>
            <input type="date" className="campo" value={meta.fechaFin} onChange={setMetaCampo('fechaFin')} />
          </div>
          <div>
            <label className="etiqueta">Total días</label>
            <input type="number" min={0} className="campo" value={meta.totalDias} onChange={setMetaCampo('totalDias')} />
          </div>
          <div>
            <label className="etiqueta">Total horas</label>
            <input type="number" min={0} step="0.5" className="campo" value={meta.totalHoras} onChange={setMetaCampo('totalHoras')} />
          </div>
        </div>

        {/* Lista de contactos guardados para autocompletar */}
        <datalist id="lista-contactos">
          {contactos.map((c) => <option key={c.id} value={c.nombre} />)}
        </datalist>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="etiqueta">Responsable (albañil, plomero…)</label>
            <input className="campo" list="lista-contactos" placeholder="Escribe o elige guardado" value={meta.responsable} onChange={(e) => elegirContacto('responsable', e.target.value)} />
          </div>
          <div>
            <label className="etiqueta">Teléfono del responsable</label>
            <input className="campo" inputMode="tel" value={meta.responsableTel} onChange={setMetaCampo('responsableTel')} />
          </div>
          <div>
            <label className="etiqueta">Supervisor</label>
            <input className="campo" list="lista-contactos" placeholder="Escribe o elige guardado" value={meta.supervisor} onChange={(e) => elegirContacto('supervisor', e.target.value)} />
          </div>
          <div>
            <label className="etiqueta">Teléfono del supervisor</label>
            <input className="campo" inputMode="tel" value={meta.supervisorTel} onChange={setMetaCampo('supervisorTel')} />
          </div>
          <div>
            <label className="etiqueta">Tiempo invertido</label>
            <input className="campo" placeholder="Ej.: 2 días" value={meta.tiempoInvertido} onChange={setMetaCampo('tiempoInvertido')} />
          </div>
          <div>
            <label className="etiqueta">Nº de factura(s) de materiales</label>
            <input className="campo" value={meta.numerosFactura} onChange={setMetaCampo('numerosFactura')} />
          </div>
          <div>
            <label className="etiqueta">Inventario consumido</label>
            <input className="campo" value={meta.inventarioConsumido} onChange={setMetaCampo('inventarioConsumido')} />
          </div>
          <div>
            <label className="etiqueta">Material sobrante</label>
            <input className="campo" value={meta.materialSobrante} onChange={setMetaCampo('materialSobrante')} />
          </div>
        </div>
        <div>
          <label className="etiqueta">Descripción general</label>
          <textarea className="campo min-h-[60px]" value={meta.descripcionGeneral} onChange={setMetaCampo('descripcionGeneral')} />
        </div>
      </section>

      {/* ---------- Fotos (Antes / Después) ---------- */}
      <section className="tarjeta p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold">Fotos ({fotos.length})</p>
            <p className="text-[11px] text-slate-500">Clasifica cada foto como Antes o Después (sin límite).</p>
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-800">
              + Antes
              <input type="file" accept="image/*" multiple className="hidden" disabled={subiendo} onChange={(e) => subirFotos(e.target.files, 'ANTES')} />
            </label>
            <label className="cursor-pointer rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
              + Después
              <input type="file" accept="image/*" multiple className="hidden" disabled={subiendo} onChange={(e) => subirFotos(e.target.files, 'DESPUES')} />
            </label>
          </div>
        </div>

        {fotos.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fotos.map((f, i) => (
              <div key={i} className={`rounded-xl border p-2 ${f.fase === 'ANTES' ? 'border-amber-300 bg-amber-50/40' : 'border-emerald-300 bg-emerald-50/40'}`}>
                <div className="flex items-start gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.imagen} alt={`Foto ${i + 1}`} className="h-20 w-28 shrink-0 rounded-lg object-cover" />
                  <div className="flex-1">
                    <span className={`text-[11px] font-semibold ${f.fase === 'ANTES' ? 'text-amber-700' : 'text-emerald-700'}`}>
                      Foto {i + 1} · {f.fase === 'ANTES' ? 'Antes' : 'Después'}
                    </span>
                    <textarea
                      className="campo mt-1 min-h-[52px] text-sm"
                      placeholder="Descripción de esta foto"
                      value={f.descripcion}
                      onChange={(e) =>
                        setFotos((prev) => prev.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))
                      }
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
                  className="mt-1 text-xs text-coral-600"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Costos (sección color-coded: fondo ámbar para finanzas) ---------- */}
      <section className="tarjeta border-l-4 border-amber-400 bg-amber-50/40 p-4 md:p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-amber-800">💰 Costos (materiales y mano de obra)</p>
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, { concepto: '', tipo: 'MATERIAL', monto: '' }])}
            className="btn-secundario px-3 py-2 text-sm"
          >
            + Añadir
          </button>
        </div>

        {items.length > 0 && (
          <div className="mt-4 space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <input
                    className="campo"
                    placeholder="Concepto (tubería, cemento, mano de obra…)"
                    value={it.concepto}
                    onChange={(e) => setItems((prev) => prev.map((x, j) => (j === i ? { ...x, concepto: e.target.value } : x)))}
                  />
                </div>
                <select
                  className="campo w-36"
                  value={it.tipo}
                  onChange={(e) => setItems((prev) => prev.map((x, j) => (j === i ? { ...x, tipo: e.target.value as ItemUI['tipo'] } : x)))}
                >
                  <option value="MATERIAL">Material</option>
                  <option value="MANO_OBRA">Mano de obra</option>
                </select>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="campo w-24"
                  placeholder="USD"
                  value={it.monto}
                  onChange={(e) => setItems((prev) => prev.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))}
                />
                <button type="button" onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))} className="btn-secundario w-11 text-coral-600">×</button>
              </div>
            ))}
            <div className="flex justify-between border-t border-amber-200 pt-2 text-sm">
              <span className="font-semibold text-amber-800">Costo total</span>
              <span className="rounded-lg bg-amber-200/60 px-3 py-1 text-lg font-bold text-amber-900">{fmtUsd(costoTotal)}</span>
            </div>
          </div>
        )}
      </section>

      {/* ---------- Materiales del inventario usados (descuenta stock) ---------- */}
      <section className="tarjeta border-l-4 border-brand-400 p-4 md:p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold">📦 Materiales usados del inventario</p>
          <button
            type="button"
            onClick={() => setMaterialesUsados((prev) => [...prev, { articuloId: '', cantidad: '1' }])}
            className="btn-secundario px-3 py-2 text-sm"
          >
            + Añadir
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Al guardar, estas cantidades se descuentan del stock global.</p>
        {materialesUsados.length > 0 && (
          <div className="mt-3 space-y-2">
            {materialesUsados.map((m, i) => (
              <div key={i} className="flex items-end gap-2">
                <select
                  className="campo flex-1"
                  value={m.articuloId}
                  onChange={(e) => setMaterialesUsados((prev) => prev.map((x, j) => (j === i ? { ...x, articuloId: e.target.value } : x)))}
                >
                  <option value="">Elige un artículo…</option>
                  {articulosInv.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre} (stock: {a.stock} {a.unidad})</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="campo w-24"
                  placeholder="Cant."
                  value={m.cantidad}
                  onChange={(e) => setMaterialesUsados((prev) => prev.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))}
                />
                <button type="button" onClick={() => setMaterialesUsados((prev) => prev.filter((_, j) => j !== i))} className="btn-secundario w-11 text-coral-600">×</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && <p className="rounded-lg bg-coral-50 p-2 text-sm text-coral-600">{error}</p>}

      <button onClick={guardar} disabled={guardando} className="btn-primario w-full">
        {guardando ? 'Guardando…' : 'Guardar y generar PDF'}
      </button>

      {/* ---------- Trabajos previos ---------- */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Trabajos registrados</h2>
        <ul className="space-y-2">
          {trabajos.map((t) => {
            const cat = categoriaMantenimiento(t.categoria);
            return (
            <li
              key={t.id}
              className="tarjeta flex items-center justify-between p-4"
              // Borde izquierdo con el color de la categoría (identificación rápida).
              style={{ borderLeft: `5px solid ${cat.color}` }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{t.titulo}</p>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: cat.colorFondo, color: cat.color, border: `1px solid ${cat.color}` }}
                  >
                    {cat.etiqueta}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(t.fecha).toLocaleDateString('es-EC')} · {t.nFotos} foto(s)
                  {t.responsable ? ` · ${t.responsable}` : ''} · {fmtUsd(t.costoTotal)}
                </p>
              </div>
              <div className="flex gap-2">
                <a href={`/api/mantenimiento/${t.id}/pdf`} target="_blank" className="btn-secundario text-sm">
                  PDF
                </a>
                <BotonCompartir
                  url={`/api/mantenimiento/${t.id}/pdf`}
                  nombreSugerido={`mantenimiento-${t.id}.pdf`}
                  titulo={`${t.titulo} · Casa Mamá Emma`}
                  className="btn-secundario text-sm"
                />
              </div>
            </li>
            );
          })}
          {trabajos.length === 0 && <p className="text-sm text-slate-400">Aún no hay trabajos registrados.</p>}
        </ul>
      </section>
    </div>
  );
}
