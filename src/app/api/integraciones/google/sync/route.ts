import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { accessTokenDesdeRefresh, upsertEvento } from '@/lib/integraciones/google';

export const dynamic = 'force-dynamic';

/**
 * POST /api/integraciones/google/sync — sincroniza a Google Calendar las
 * reservas que ya tienen factura, creando/actualizando un evento por reserva
 * con un ENLACE DIRECTO al PDF (RIDE) de la factura en la descripción.
 */
export async function POST() {
  const cfg = await prisma.integraciones.findUnique({ where: { id: 1 } });
  if (!cfg?.googleRefreshToken) {
    return NextResponse.json({ error: 'Google Calendar no está conectado' }, { status: 400 });
  }

  const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const accessToken = await accessTokenDesdeRefresh(cfg.googleRefreshToken);

  // Reservas con factura emitida (para poder enlazar el PDF).
  const reservas = await prisma.reserva.findMany({
    where: { facturaId: { not: null } },
    orderBy: { checkIn: 'asc' },
    take: 200,
  });

  let sincronizadas = 0;
  const errores: string[] = [];

  for (const r of reservas) {
    if (!r.facturaId) continue;
    const factura = await prisma.factura.findUnique({ where: { id: r.facturaId } });
    const enlacePdf = `${appUrl}/api/facturas/${r.facturaId}/pdf`;

    const titulo = `Casa Mamá Emma · ${r.huespedNombre ?? r.resumen ?? 'Reserva'}`;
    const descripcion = [
      factura ? `Factura: ${factura.numeroCompleto}` : 'Factura vinculada',
      r.numHuespedes ? `Huéspedes: ${r.numHuespedes}` : null,
      r.numeroHabitacion ? `Habitación: ${r.numeroHabitacion}` : null,
      '',
      `📄 Documento (RIDE): ${enlacePdf}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const eventoId = await upsertEvento(
        accessToken,
        cfg.googleCalendarId,
        { titulo, descripcion, inicio: r.checkIn, fin: r.checkOut, diaCompleto: true },
        r.eventoGoogleId,
      );
      if (eventoId !== r.eventoGoogleId) {
        await prisma.reserva.update({ where: { id: r.id }, data: { eventoGoogleId: eventoId } });
      }
      sincronizadas++;
    } catch (e) {
      errores.push(`Reserva ${r.id}: ${(e as Error).message}`);
    }
  }

  await prisma.integraciones.update({ where: { id: 1 }, data: { ultimaSyncGoogle: new Date() } });

  return NextResponse.json({ ok: true, sincronizadas, errores });
}
