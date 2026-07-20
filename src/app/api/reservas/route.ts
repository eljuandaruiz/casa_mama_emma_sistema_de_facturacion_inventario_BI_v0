import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { buscarConflicto } from '@/lib/ocupacion';

export const dynamic = 'force-dynamic';

/** GET /api/reservas — próximas reservas importadas (y su estado de factura/sync). */
export async function GET(req: Request) {
  const desde = new URL(req.url).searchParams.get('desde');
  const where = desde ? { checkOut: { gte: new Date(desde) } } : {};
  const reservas = await prisma.reserva.findMany({
    where,
    orderBy: { checkIn: 'asc' },
    take: 200,
  });
  return NextResponse.json(reservas);
}

const crearSchema = z.object({
  huespedNombre: z.string().min(1),
  numHuespedes: z.coerce.number().int().min(1).optional(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  numeroHabitacion: z.coerce.number().int(),
});

/**
 * POST /api/reservas — crea un "hold" MANUAL (bloqueo directo, no-Airbnb)
 * para reservar una habitación sin emitir factura todavía. A diferencia de
 * las integraciones externas, esta validación SÍ bloquea: es la función
 * central del módulo (evitar overbooking), no un best-effort.
 */
export async function POST(req: Request) {
  const parsed = crearSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalle: parsed.error.flatten() }, { status: 400 });
  }
  const { huespedNombre, numHuespedes, numeroHabitacion } = parsed.data;
  const checkIn = new Date(parsed.data.checkIn);
  const checkOut = new Date(parsed.data.checkOut);
  if (!(checkIn < checkOut)) {
    return NextResponse.json({ error: 'El check-out debe ser posterior al check-in' }, { status: 400 });
  }

  const habitacion = await prisma.habitacion.findUnique({ where: { numero: numeroHabitacion } });
  if (!habitacion || !habitacion.activa) {
    return NextResponse.json({ error: 'Habitación inválida o inactiva' }, { status: 400 });
  }

  const conflicto = await buscarConflicto(numeroHabitacion, checkIn, checkOut);
  if (conflicto) {
    return NextResponse.json(
      { error: `Habitación ${numeroHabitacion} ya está ocupada en esas fechas (${conflicto.origen}: ${conflicto.etiqueta})`, conflicto },
      { status: 409 },
    );
  }

  const reserva = await prisma.reserva.create({
    data: {
      fuente: 'MANUAL',
      uid: `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      huespedNombre,
      numHuespedes: numHuespedes ?? null,
      checkIn,
      checkOut,
      numeroHabitacion,
    },
  });
  return NextResponse.json(reserva, { status: 201 });
}

const asignarSchema = z.object({
  id: z.coerce.number().int(),
  numeroHabitacion: z.coerce.number().int(),
});

/** PATCH /api/reservas — asigna/corrige la habitación de una reserva existente (p. ej. una importada de Airbnb sin habitación asignada). */
export async function PATCH(req: Request) {
  const parsed = asignarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalle: parsed.error.flatten() }, { status: 400 });
  }
  const { id, numeroHabitacion } = parsed.data;

  const existente = await prisma.reserva.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });

  const habitacion = await prisma.habitacion.findUnique({ where: { numero: numeroHabitacion } });
  if (!habitacion || !habitacion.activa) {
    return NextResponse.json({ error: 'Habitación inválida o inactiva' }, { status: 400 });
  }

  const conflicto = await buscarConflicto(numeroHabitacion, existente.checkIn, existente.checkOut, id);
  if (conflicto) {
    return NextResponse.json(
      { error: `Habitación ${numeroHabitacion} ya está ocupada en esas fechas (${conflicto.origen}: ${conflicto.etiqueta})`, conflicto },
      { status: 409 },
    );
  }

  const reserva = await prisma.reserva.update({ where: { id }, data: { numeroHabitacion } });
  return NextResponse.json(reserva);
}

/** DELETE /api/reservas?id=123 — libera un hold MANUAL (no se pueden borrar reservas importadas de Airbnb: se resuelven reimportando el iCal). */
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const existente = await prisma.reserva.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  if (existente.fuente !== 'MANUAL') {
    return NextResponse.json({ error: 'Solo se pueden eliminar holds manuales' }, { status: 400 });
  }

  await prisma.reserva.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
