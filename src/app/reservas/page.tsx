import Link from 'next/link';
import { requiereRol } from '@/lib/auth/servidor';
import { prisma } from '@/lib/db';
import { ImportarCsvAirbnb } from '@/components/ImportarCsvAirbnb';

export const dynamic = 'force-dynamic';

const fmtFecha = (d: Date) => d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });

/** Reservas importadas desde Airbnb (ADMIN/FACTURADOR). */
export default async function PaginaReservas() {
  await requiereRol('FACTURADOR');

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const reservas = await prisma.reserva.findMany({
    where: { checkOut: { gte: hoy } },
    orderBy: { checkIn: 'asc' },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reservas</h1>
          <p className="text-sm text-slate-500">Importadas desde Airbnb (iCal)</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link href="/integraciones" className="btn-secundario text-sm">
            Integraciones
          </Link>
          <ImportarCsvAirbnb />
        </div>
      </header>

      {reservas.length === 0 ? (
        <div className="tarjeta p-8 text-center">
          <span className="text-4xl">📅</span>
          <p className="mt-2 text-sm text-slate-500">No hay reservas próximas.</p>
          <p className="mt-1 text-xs text-slate-400">
            Configura e importa el iCal de Airbnb en{' '}
            <Link href="/integraciones" className="text-brand-700 underline">
              Integraciones
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {reservas.map((r) => (
            <li key={r.id} className="tarjeta flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{r.huespedNombre ?? r.resumen ?? 'Reserva'}</p>
                <p className="text-xs text-slate-500">
                  {fmtFecha(r.checkIn)} → {fmtFecha(r.checkOut)}
                  {r.numHuespedes ? ` · ${r.numHuespedes} huésped(es)` : ''}
                  {r.numeroHabitacion ? ` · Hab. ${r.numeroHabitacion}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {r.facturaId ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                    Facturada
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                    Sin factura
                  </span>
                )}
                {r.eventoGoogleId && <span title="En Google Calendar">📅</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
