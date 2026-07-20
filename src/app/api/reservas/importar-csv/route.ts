import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { parseAirbnbCsv } from '@/lib/integraciones/airbnbCsv';

export const dynamic = 'force-dynamic';

const schema = z.object({ contenido: z.string().min(10).max(5_000_000) });

/**
 * POST /api/reservas/importar-csv — importa el CSV de reservaciones que
 * exporta Airbnb. Idempotente: upsert por código de confirmación (uid
 * "CSV-<código>"). Las canceladas existentes se eliminan; las nuevas
 * canceladas se ignoran. A diferencia del iCal, el CSV SÍ trae nombre del
 * huésped, nº de huéspedes y ganancias.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const { reservas, errores } = parseAirbnbCsv(parsed.data.contenido);
  if (errores.length > 0) return NextResponse.json({ error: errores.join(' · ') }, { status: 400 });

  let creadas = 0;
  let actualizadas = 0;
  let canceladas = 0;
  let omitidas = 0;

  for (const r of reservas) {
    const uid = `CSV-${r.codigoConfirmacion}`;
    const existente = await prisma.reserva.findUnique({ where: { uid } });

    if (r.cancelada) {
      // Cancelada: si estaba importada, se libera el calendario.
      if (existente && !existente.facturaId) {
        await prisma.reserva.delete({ where: { uid } });
        canceladas++;
      } else omitidas++;
      continue;
    }
    if (!r.checkIn || !r.checkOut) { omitidas++; continue; }

    const numHuespedes = r.adultos != null ? r.adultos + (r.ninos ?? 0) : null;
    const datos = {
      fuente: 'AIRBNB',
      resumen: r.ganancias ? `Airbnb CSV · payout ${r.ganancias}` : 'Airbnb CSV',
      huespedNombre: r.huesped,
      numHuespedes,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
    };
    if (existente) {
      await prisma.reserva.update({ where: { uid }, data: datos });
      actualizadas++;
    } else {
      await prisma.reserva.create({ data: { uid, ...datos } });
      creadas++;
    }
  }

  return NextResponse.json({ ok: true, total: reservas.length, creadas, actualizadas, canceladas, omitidas });
}
