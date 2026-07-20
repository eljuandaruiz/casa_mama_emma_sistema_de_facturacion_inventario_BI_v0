'use client';

/**
 * Panel de integraciones (ADMIN): conectar el iCal de Airbnb y Google
 * Calendar, e importar/sincronizar.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface Estado {
  airbnbIcalUrl: string;
  airbnbConfigurado: boolean;
  googleConectado: boolean;
  googleConectadoEmail: string | null;
  googleCalendarId: string;
  googleDisponible: boolean;
  ultimaSyncAirbnb: string | null;
  ultimaSyncGoogle: string | null;
}

export function PanelIntegraciones() {
  const params = useSearchParams();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [icalUrl, setIcalUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [cargandoAccion, setCargandoAccion] = useState('');

  const cargar = () =>
    fetch('/api/integraciones')
      .then((r) => r.json())
      .then((e: Estado) => {
        setEstado(e);
        setIcalUrl(e.airbnbIcalUrl);
      });

  useEffect(() => {
    void cargar();
    const g = params.get('google');
    if (g === 'ok') setMsg('✅ Google Calendar conectado.');
    else if (g === 'error') setMsg('❌ No se pudo conectar Google.');
    else if (g === 'sin_refresh') setMsg('⚠️ Google no devolvió refresh token; revoca el acceso e intenta de nuevo.');
  }, [params]);

  const guardarIcal = async () => {
    setCargandoAccion('ical');
    setMsg('');
    const res = await fetch('/api/integraciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ airbnbIcalUrl: icalUrl }),
    });
    setMsg(res.ok ? '✅ URL de Airbnb guardada.' : '❌ URL inválida.');
    setCargandoAccion('');
    cargar();
  };

  const importarAirbnb = async () => {
    setCargandoAccion('importar');
    setMsg('');
    const res = await fetch('/api/reservas/importar', { method: 'POST' });
    const j = await res.json();
    setMsg(res.ok ? `✅ Importadas: ${j.creadas} nuevas, ${j.actualizadas} actualizadas.` : `❌ ${j.error}`);
    setCargandoAccion('');
    cargar();
  };

  const syncGoogle = async () => {
    setCargandoAccion('sync');
    setMsg('');
    const res = await fetch('/api/integraciones/google/sync', { method: 'POST' });
    const j = await res.json();
    setMsg(res.ok ? `✅ Sincronizadas ${j.sincronizadas} reservas en Google Calendar.` : `❌ ${j.error}`);
    setCargandoAccion('');
    cargar();
  };

  if (!estado) return <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Integraciones</h1>
        <p className="text-sm text-slate-500">Airbnb (iCal) y Google Calendar</p>
      </header>

      {msg && <p className="tarjeta p-3 text-sm">{msg}</p>}

      {/* ---------- Airbnb ---------- */}
      <section className="tarjeta space-y-3 p-4 md:p-5">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏠</span>
          <h2 className="font-semibold">Airbnb · Importar reservas (iCal)</h2>
        </div>
        <p className="text-xs text-slate-500">
          Airbnb no ofrece una API pública abierta, pero sí un enlace de calendario iCal por
          alojamiento. Cópialo en Airbnb → Calendario → Disponibilidad → “Conectar con otro
          sitio web” → Exportar calendario, y pégalo aquí.
        </p>
        <input
          className="campo"
          placeholder="https://www.airbnb.com/calendar/ical/....ics"
          value={icalUrl}
          onChange={(e) => setIcalUrl(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={guardarIcal} disabled={cargandoAccion === 'ical'} className="btn-secundario text-sm">
            Guardar URL
          </button>
          <button
            onClick={importarAirbnb}
            disabled={!estado.airbnbConfigurado || cargandoAccion === 'importar'}
            className="btn-primario text-sm"
          >
            {cargandoAccion === 'importar' ? 'Importando…' : 'Importar ahora'}
          </button>
        </div>
        {estado.ultimaSyncAirbnb && (
          <p className="text-[11px] text-slate-400">
            Última importación: {new Date(estado.ultimaSyncAirbnb).toLocaleString('es-EC')}
          </p>
        )}
      </section>

      {/* ---------- Google Calendar ---------- */}
      <section className="tarjeta space-y-3 p-4 md:p-5">
        <div className="flex items-center gap-2">
          <span className="text-xl">📅</span>
          <h2 className="font-semibold">Google Calendar · Sincronizar reservas</h2>
        </div>

        {!estado.googleDisponible ? (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            Faltan credenciales de Google en el servidor (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
            Configúralas en <span className="font-mono">.env</span> para habilitar esta integración.
          </p>
        ) : estado.googleConectado ? (
          <>
            <p className="text-sm text-emerald-700">
              ✅ Conectado{estado.googleConectadoEmail ? ` como ${estado.googleConectadoEmail}` : ''}.
            </p>
            <p className="text-xs text-slate-500">
              Cada reserva con factura se publica como evento con el enlace directo al PDF (RIDE).
            </p>
            <button onClick={syncGoogle} disabled={cargandoAccion === 'sync'} className="btn-primario text-sm">
              {cargandoAccion === 'sync' ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
            {estado.ultimaSyncGoogle && (
              <p className="text-[11px] text-slate-400">
                Última sincronización: {new Date(estado.ultimaSyncGoogle).toLocaleString('es-EC')}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              Conecta tu cuenta de Google para publicar las reservas como eventos con el enlace al
              documento de facturación.
            </p>
            <a href="/api/integraciones/google/iniciar" className="btn-primario inline-block text-sm">
              Conectar Google Calendar
            </a>
          </>
        )}
      </section>
    </div>
  );
}
