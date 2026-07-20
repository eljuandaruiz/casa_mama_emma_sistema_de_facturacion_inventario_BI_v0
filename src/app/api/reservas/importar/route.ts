import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseIcal, inferirHuespedes } from '@/lib/integraciones/ical';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reservas/importar — descarga el iCal de Airbnb configurado y
 * hace upsert de las reservas (idempotente por UID). Airbnb no da API
 * pública; el iCal es el mecanismo real y soportado.
 */
export async function POST() {
  const cfg = await prisma.integraciones.findUnique({ where: { id: 1 } });
  if (!cfg?.airbnbIcalUrl) {
    return NextResponse.json({ error: 'Configura primero la URL iCal de Airbnb' }, { status: 400 });
  }

  let texto: string;
  try {
    const res = await fetch(cfg.airbnbIcalUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    texto = await res.text();
  } catch (e) {
    return NextResponse.json(
      { error: `No se pudo descargar el iCal: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  const eventos = parseIcal(texto);
  let creadas = 0;
  let actualizadas = 0;

  for (const ev of eventos) {
    // Airbnb marca los bloqueos como "Not available"/"Blocked": los saltamos.
    const resumen = ev.resumen ?? '';
    const esBloqueo = /not available|blocked|no disponible/i.test(resumen);
    if (esBloqueo) continue;

    const existente = await prisma.reserva.findUnique({ where: { uid: ev.uid } });
    const datos = {
      fuente: 'AIRBNB',
      resumen: resumen || null,
      huespedNombre: null as string | null,
      numHuespedes: inferirHuespedes(ev.descripcion) ?? null,
      checkIn: ev.inicio,
      checkOut: ev.fin,
    };

    if (existente) {
      await prisma.reserva.update({ where: { uid: ev.uid }, data: datos });
      actualizadas++;
    } else {
      await prisma.reserva.create({ data: { uid: ev.uid, ...datos } });
      creadas++;
    }
  }

  await prisma.integraciones.update({ where: { id: 1 }, data: { ultimaSyncAirbnb: new Date() } });

  return NextResponse.json({ ok: true, total: eventos.length, creadas, actualizadas });
}
