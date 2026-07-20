'use client';

/**
 * Bandeja interna de solicitudes del portal de huéspedes. El facturador ve
 * las solicitudes PENDIENTES, puede facturar desde una (autocompleta el
 * formulario vía querystring) o descartarla.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Solicitud {
  id: number;
  nombre: string;
  tipoIdentificacion: string;
  identificacion: string;
  direccion: string | null;
  email: string | null;
  telefono: string | null;
  nacionalidad: string | null;
  numeroHabitacion: number | null;
  mensaje: string | null;
  estado: string;
  creadoEn: string;
}

const TIPO: Record<string, string> = { '05': 'Cédula', '06': 'Pasaporte', '04': 'RUC' };

export function BandejaSolicitudes() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    void fetch('/api/solicitudes?estado=PENDIENTE')
      .then((r) => r.json())
      .then((d) => {
        setSolicitudes(d);
        setCargando(false);
      });
  }, []);

  useEffect(() => cargar(), [cargar]);

  const descartar = async (id: number) => {
    await fetch('/api/solicitudes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado: 'DESCARTADA' }),
    });
    cargar();
  };

  // Enlace a facturar autocompletando el cliente (habitación indicada o la 2).
  const enlaceFacturar = (s: Solicitud) => {
    const hab = s.numeroHabitacion ?? 2;
    const q = new URLSearchParams({
      tipoId: s.tipoIdentificacion,
      ident: s.identificacion,
      nombre: s.nombre,
      solicitud: String(s.id),
    });
    if (s.direccion) q.set('direccion', s.direccion);
    if (s.email) q.set('email', s.email);
    if (s.telefono) q.set('telefono', s.telefono);
    if (s.nacionalidad) q.set('nacionalidad', s.nacionalidad);
    // hab es el número de habitación; la página de facturar usa el id, pero
    // el número coincide con el orden; se resuelve en la página destino.
    return `/facturar/num/${hab}?${q.toString()}`;
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes del portal</h1>
          <p className="text-sm text-slate-500">Datos que dejaron los huéspedes para facturar</p>
        </div>
        <button onClick={cargar} className="btn-secundario px-3 py-2 text-sm">
          ↻ Actualizar
        </button>
      </header>

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
      ) : solicitudes.length === 0 ? (
        <div className="tarjeta p-8 text-center">
          <span className="text-4xl">📭</span>
          <p className="mt-2 text-sm text-slate-500">No hay solicitudes pendientes.</p>
          <p className="mt-1 text-xs text-slate-400">
            Comparte el enlace <span className="font-mono">/portal</span> con tus huéspedes.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {solicitudes.map((s) => (
            <li key={s.id} className="tarjeta p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{s.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {TIPO[s.tipoIdentificacion] ?? s.tipoIdentificacion}: {s.identificacion}
                    {s.nacionalidad ? ` · ${s.nacionalidad}` : ''}
                    {s.numeroHabitacion ? ` · Hab. ${s.numeroHabitacion}` : ''}
                  </p>
                  {(s.email || s.telefono) && (
                    <p className="text-xs text-slate-500">
                      {s.email}{s.email && s.telefono ? ' · ' : ''}{s.telefono}
                    </p>
                  )}
                  {s.direccion && <p className="text-xs text-slate-400">{s.direccion}</p>}
                  {s.mensaje && (
                    <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs italic text-slate-600">
                      “{s.mensaje}”
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">
                  {new Date(s.creadoEn).toLocaleString('es-EC')}
                </span>
              </div>

              <div className="mt-3 flex gap-2">
                <Link href={enlaceFacturar(s)} className="btn-primario flex-1 text-center text-sm">
                  Facturar con estos datos
                </Link>
                <button onClick={() => descartar(s.id)} className="btn-secundario text-sm text-coral-600">
                  Descartar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
