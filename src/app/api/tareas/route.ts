import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { googleConfigurado, accessTokenDesdeRefresh, upsertEvento } from '@/lib/integraciones/google';

export const dynamic = 'force-dynamic';

/**
 * TAREAS / AGENDA — módulo interconectado:
 *  · Se pueden crear tareas sueltas o vinculadas a otro módulo (origen).
 *  · Cada tarea se sincroniza BEST-EFFORT al Google Calendar del dueño
 *    (la cuenta conectada en /integraciones, p. ej. juan.ruiz.ceo@gmail.com):
 *    si Google no está conectado, la tarea vive igual en el sistema.
 */

/** Sincroniza una tarea al calendario conectado. Nunca lanza. */
async function sincronizarConGoogle(tareaId: number): Promise<void> {
  try {
    if (!googleConfigurado()) return;
    const cfg = await prisma.integraciones.findUnique({ where: { id: 1 } });
    if (!cfg?.googleRefreshToken) return;
    const tarea = await prisma.tarea.findUnique({ where: { id: tareaId } });
    if (!tarea) return;

    const token = await accessTokenDesdeRefresh(cfg.googleRefreshToken);
    const eventoId = await upsertEvento(
      token,
      cfg.googleCalendarId,
      {
        titulo: `${tarea.completada ? '✔ ' : ''}${tarea.titulo} · Casa Mamá Emma`,
        descripcion: tarea.descripcion ?? `Tarea del sistema (origen: ${tarea.origen})`,
        inicio: tarea.fecha,
        fin: new Date(tarea.fecha.getTime() + tarea.duracionMin * 60_000),
      },
      tarea.eventoGoogleId,
    );
    if (eventoId !== tarea.eventoGoogleId) {
      await prisma.tarea.update({ where: { id: tareaId }, data: { eventoGoogleId: eventoId } });
    }
  } catch {
    // best-effort: la agenda local nunca depende de Google
  }
}

/** GET /api/tareas — pendientes primero, luego completadas recientes. */
export async function GET() {
  const [pendientes, completadas] = await Promise.all([
    prisma.tarea.findMany({ where: { completada: false }, orderBy: { fecha: 'asc' } }),
    prisma.tarea.findMany({ where: { completada: true }, orderBy: { fecha: 'desc' }, take: 20 }),
  ]);
  return NextResponse.json({ pendientes, completadas });
}

const crear = z.object({
  titulo: z.string().trim().min(2).max(120),
  descripcion: z.string().trim().max(500).optional(),
  fecha: z.string().min(1), // ISO local "2026-07-20T10:00"
  duracionMin: z.coerce.number().int().min(5).max(24 * 60).default(60),
  origen: z.string().max(30).default('MANUAL'),
  referenciaId: z.string().max(60).optional(),
});

/** POST /api/tareas — crea la tarea y la sube al Google Calendar (best-effort). */
export async function POST(req: Request) {
  const parsed = crear.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const d = parsed.data;
  const fecha = new Date(d.fecha);
  if (Number.isNaN(fecha.getTime())) return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });

  const tarea = await prisma.tarea.create({
    data: {
      titulo: d.titulo,
      descripcion: d.descripcion || null,
      fecha,
      duracionMin: d.duracionMin,
      origen: d.origen,
      referenciaId: d.referenciaId || null,
    },
  });
  void sincronizarConGoogle(tarea.id);
  return NextResponse.json(tarea, { status: 201 });
}

const editar = z.object({
  id: z.number().int(),
  completada: z.boolean().optional(),
  titulo: z.string().trim().min(2).max(120).optional(),
  fecha: z.string().optional(),
});

/** PATCH /api/tareas — marca completada / edita, y re-sincroniza. */
export async function PATCH(req: Request) {
  const parsed = editar.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const { id, fecha, ...resto } = parsed.data;

  const data: Record<string, unknown> = { ...resto };
  if (fecha) {
    const f = new Date(fecha);
    if (Number.isNaN(f.getTime())) return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
    data.fecha = f;
  }
  const tarea = await prisma.tarea.update({ where: { id }, data });
  void sincronizarConGoogle(tarea.id);
  return NextResponse.json(tarea);
}

/** DELETE /api/tareas?id=1 */
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  await prisma.tarea.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
