import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { googleConfigurado } from '@/lib/integraciones/google';

export const dynamic = 'force-dynamic';

async function getIntegraciones() {
  return prisma.integraciones.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** GET /api/integraciones — estado de las integraciones (sin exponer tokens). */
export async function GET() {
  const i = await getIntegraciones();
  return NextResponse.json({
    airbnbIcalUrl: i.airbnbIcalUrl ?? '',
    airbnbConfigurado: Boolean(i.airbnbIcalUrl),
    googleConectado: Boolean(i.googleRefreshToken),
    googleConectadoEmail: i.googleConectadoEmail,
    googleCalendarId: i.googleCalendarId,
    googleDisponible: googleConfigurado(), // hay client id/secret en el entorno
    ultimaSyncAirbnb: i.ultimaSyncAirbnb,
    ultimaSyncGoogle: i.ultimaSyncGoogle,
  });
}

const schema = z.object({
  airbnbIcalUrl: z.string().url().optional().or(z.literal('')),
  googleCalendarId: z.string().min(1).optional(),
});

/** PATCH /api/integraciones — guarda la URL iCal de Airbnb y/o el calendario. */
export async function PATCH(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const d = parsed.data;
  const i = await prisma.integraciones.upsert({
    where: { id: 1 },
    update: {
      ...(d.airbnbIcalUrl !== undefined ? { airbnbIcalUrl: d.airbnbIcalUrl || null } : {}),
      ...(d.googleCalendarId ? { googleCalendarId: d.googleCalendarId } : {}),
    },
    create: { id: 1, airbnbIcalUrl: d.airbnbIcalUrl || null },
  });
  return NextResponse.json({ ok: true, airbnbConfigurado: Boolean(i.airbnbIcalUrl) });
}
