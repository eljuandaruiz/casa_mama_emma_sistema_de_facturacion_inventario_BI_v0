import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buscarConflicto } from '@/lib/ocupacion';

export const dynamic = 'force-dynamic';

const schema = z.object({
  numeroHabitacion: z.coerce.number().int(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
});

/**
 * GET /api/ocupacion/disponibilidad?numeroHabitacion=2&checkIn=2026-08-01&checkOut=2026-08-03
 * Chequeo INFORMATIVO (no bloqueante): usado por el formulario de factura
 * para avisar si la habitación ya tiene una reserva/factura en esas fechas.
 */
export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { numeroHabitacion, checkIn, checkOut } = parsed.data;
  const conflicto = await buscarConflicto(numeroHabitacion, new Date(checkIn), new Date(checkOut));

  return NextResponse.json({ libre: !conflicto, conflicto });
}
