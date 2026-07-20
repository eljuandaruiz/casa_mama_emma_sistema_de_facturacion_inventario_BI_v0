import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { etiquetaArea } from '@/lib/areas';
import { cuadranteDe } from '@/lib/eisenhower';
import { accessTokenDesdeRefresh, upsertEvento } from '@/lib/integraciones/google';

export const dynamic = 'force-dynamic';

/** GET /api/reparaciones?estado=ABIERTA — solicitudes (filtro por estado). */
export async function GET(req: Request) {
  const estado = new URL(req.url).searchParams.get('estado');
  const solicitudes = await prisma.solicitudReparacion.findMany({
    where: estado && estado !== 'TODAS' ? { estado } : {},
    orderBy: [{ estado: 'asc' }, { fechaLimite: 'asc' }],
    take: 200,
  });
  return NextResponse.json(solicitudes);
}

const crear = z.object({
  titulo: z.string().trim().min(3).max(120),
  descripcion: z.string().trim().min(3).max(1000),
  area: z.string().max(20).optional(),
  imagen: z.string().startsWith('data:image/').optional().or(z.literal('')),
  detectadoPor: z.string().max(80).optional(),
  prioridad: z
    .enum(['URGENTE_IMPORTANTE', 'IMPORTANTE_NO_URGENTE', 'URGENTE_NO_IMPORTANTE', 'NI_URGENTE_NI_IMPORTANTE'])
    .default('IMPORTANTE_NO_URGENTE'),
  fechaLimite: z.string().optional(), // ISO date
});

/**
 * POST /api/reparaciones — crea una solicitud. Si Google Calendar está
 * conectado y hay fecha límite, publica un evento con el vencimiento.
 */
export async function POST(req: Request) {
  const parsed = crear.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }
  const d = parsed.data;

  const solicitud = await prisma.solicitudReparacion.create({
    data: {
      titulo: d.titulo,
      descripcion: d.descripcion,
      area: d.area || null,
      imagen: d.imagen || null,
      detectadoPor: d.detectadoPor || null,
      prioridad: d.prioridad,
      fechaLimite: d.fechaLimite ? new Date(d.fechaLimite) : null,
    },
  });

  // Sincroniza a Google Calendar si está conectado y hay fecha límite.
  let sincronizado = false;
  if (solicitud.fechaLimite) {
    const cfg = await prisma.integraciones.findUnique({ where: { id: 1 } });
    if (cfg?.googleRefreshToken) {
      try {
        const token = await accessTokenDesdeRefresh(cfg.googleRefreshToken);
        const cuad = cuadranteDe(solicitud.prioridad);
        const eventoId = await upsertEvento(
          token,
          cfg.googleCalendarId,
          {
            titulo: `🔧 [${cuad.etiqueta}] ${solicitud.titulo}`,
            descripcion:
              `Solicitud de reparación · Casa Mamá Emma\n` +
              `Área: ${etiquetaArea(solicitud.area)}\n` +
              `Detectado por: ${solicitud.detectadoPor ?? '—'}\n\n${solicitud.descripcion}`,
            inicio: solicitud.fechaLimite,
            fin: solicitud.fechaLimite,
            diaCompleto: true,
          },
          null,
        );
        await prisma.solicitudReparacion.update({ where: { id: solicitud.id }, data: { eventoGoogleId: eventoId } });
        sincronizado = true;
      } catch {
        // Si Google falla, la solicitud igual queda creada localmente.
        sincronizado = false;
      }
    }
  }

  return NextResponse.json({ id: solicitud.id, sincronizadoGoogle: sincronizado }, { status: 201 });
}

const patch = z.object({
  id: z.number().int(),
  estado: z.enum(['ABIERTA', 'EN_PROCESO', 'RESUELTA', 'DESCARTADA']),
});

/** PATCH /api/reparaciones — cambia el estado de una solicitud. */
export async function PATCH(req: Request) {
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const s = await prisma.solicitudReparacion.update({
    where: { id: parsed.data.id },
    data: { estado: parsed.data.estado },
  });
  return NextResponse.json(s);
}
