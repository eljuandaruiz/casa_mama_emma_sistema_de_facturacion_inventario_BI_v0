'use client';

/**
 * Listado de facturas con filtro mensual, estado SRI en vivo,
 * descarga del RIDE y reintento de envío (esquema offline 72h).
 */
import { useCallback, useEffect, useState } from 'react';
import { fmtUsd } from '@/lib/money';
import { BotonCompartir } from '@/components/BotonCompartir';

interface FacturaDto {
  id: string;
  numeroCompleto: string;
  fechaEmision: string;
  estadoSri: string;
  importeTotal: number;
  claveAcceso: string;
  anulada: boolean;
  pagoComprobante: string | null;
  cliente: { razonSocial: string; identificacion: string };
}

const COLORES_ESTADO: Record<string, string> = {
  AUTORIZADA: 'bg-emerald-50 text-emerald-700',
  RECIBIDA: 'bg-sky-50 text-sky-700',
  EN_PROCESO: 'bg-amber-50 text-amber-700',
  FIRMADA: 'bg-amber-50 text-amber-700',
  GENERADA: 'bg-slate-100 text-slate-600',
  DEVUELTA: 'bg-coral-50 text-coral-600',
  NO_AUTORIZADA: 'bg-coral-50 text-coral-600',
  ERROR_ENVIO: 'bg-coral-50 text-coral-600',
  ERROR_FIRMA: 'bg-coral-50 text-coral-600',
};

const mesActual = () => new Date().toISOString().slice(0, 7);
/** Último día del mes "YYYY-MM" → "YYYY-MM-DD" (para el rango de exportación). */
const finDeMes = (m: string) => {
  const [y, mm] = m.split('-').map(Number);
  return `${m}-${String(new Date(y, mm, 0).getDate()).padStart(2, '0')}`;
};

export default function PaginaFacturas() {
  const [mes, setMes] = useState(mesActual());
  const [facturas, setFacturas] = useState<FacturaDto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [reintentando, setReintentando] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await fetch(`/api/facturas?mes=${mes}`);
    setFacturas(await res.json());
    setCargando(false);
  }, [mes]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const reintentar = async (id: string) => {
    setReintentando(id);
    await fetch(`/api/facturas/${id}/reintentar`, { method: 'POST' });
    await cargar();
    setReintentando('');
  };

  const anular = async (id: string, numero: string) => {
    const motivo = window.prompt(`Motivo de anulación de la factura ${numero}:`);
    if (!motivo || motivo.trim().length < 3) return;
    const res = await fetch(`/api/facturas/${id}/anular`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: motivo.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      window.alert(json.error ?? 'No se pudo anular');
    } else {
      window.alert(`Factura anulada.\n\n${json.guiaSri}`);
      await cargar();
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Facturas</h1>
        <input
          type="month"
          className="campo max-w-[180px]"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          aria-label="Filtrar por mes"
        />
      </header>

      <div className="flex flex-wrap gap-2">
        {/* Descargas del MES filtrado (mismo mes que la lista). */}
        <a href={`/api/exportar?formato=xlsx&desde=${mes}-01&hasta=${finDeMes(mes)}`} className="btn-secundario text-sm">
          ⬇️ Excel del mes {mes}
        </a>
        <a href={`/api/exportar?formato=csv&tipo=ventas&desde=${mes}-01&hasta=${finDeMes(mes)}`} className="btn-secundario text-sm">
          ⬇️ Ventas .csv del mes
        </a>
        <a href={`/api/exportar?formato=xlsx`} className="btn-secundario text-sm">
          ⬇️ Excel completo
        </a>
      </div>

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
      ) : facturas.length === 0 ? (
        <p className="tarjeta p-8 text-center text-sm text-slate-500">
          No hay facturas en {mes}. Emite la primera desde el inicio 🏠
        </p>
      ) : (
        <ul className="space-y-3">
          {facturas.map((f) => {
            const pendiente = ['FIRMADA', 'RECIBIDA', 'EN_PROCESO', 'ERROR_ENVIO'].includes(f.estadoSri);
            return (
              <li key={f.id} className="tarjeta p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{f.numeroCompleto}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(f.fechaEmision).toLocaleString('es-EC')} · {f.cliente.razonSocial}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${f.anulada ? 'text-slate-400 line-through' : 'text-brand-700'}`}>
                      {fmtUsd(f.importeTotal)}
                    </p>
                    {f.anulada ? (
                      <span className="mt-1 inline-block rounded-full bg-coral-50 px-2 py-0.5 text-[10px] font-semibold text-coral-600">
                        ANULADA
                      </span>
                    ) : (
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${COLORES_ESTADO[f.estadoSri] ?? 'bg-slate-100 text-slate-600'}`}
                      >
                        {f.estadoSri.replaceAll('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/api/facturas/${f.id}/pdf`}
                    target="_blank"
                    className="btn-secundario px-3 py-2 text-xs"
                  >
                    📄 PDF (RIDE)
                  </a>
                  <a
                    href={`/api/facturas/${f.id}/ticket`}
                    target="_blank"
                    className="btn-secundario px-3 py-2 text-xs"
                  >
                    🧾 Ticket
                  </a>
                  {/* Pago por transferencia: foto del comprobante para revisión. */}
                  {f.pagoComprobante && (
                    <a
                      href={`/api/facturas/${f.id}/comprobante`}
                      target="_blank"
                      className="btn-secundario px-3 py-2 text-xs text-sri-blue"
                    >
                      📎 Comprobante transferencia
                    </a>
                  )}
                  <BotonCompartir
                    url={`/api/facturas/${f.id}/pdf`}
                    nombreSugerido={`factura-${f.numeroCompleto}.pdf`}
                    titulo={`Factura ${f.numeroCompleto} · Casa Mamá Emma`}
                    className="btn-secundario px-3 py-2 text-xs"
                  />
                  {pendiente && !f.anulada && (
                    <button
                      onClick={() => reintentar(f.id)}
                      disabled={reintentando === f.id}
                      className="btn-secundario px-3 py-2 text-xs"
                    >
                      {reintentando === f.id ? 'Consultando SRI…' : '🔄 Reintentar autorización'}
                    </button>
                  )}
                  {!f.anulada && (
                    <button
                      onClick={() => anular(f.id, f.numeroCompleto)}
                      className="btn-secundario px-3 py-2 text-xs text-coral-600"
                    >
                      🚫 Anular
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
