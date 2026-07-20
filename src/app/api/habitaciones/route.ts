import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/habitaciones — grid del dashboard */
export async function GET() {
  const habitaciones = await prisma.habitacion.findMany({
    where: { activa: true },
    orderBy: { numero: 'asc' },
  });
  return NextResponse.json(habitaciones);
}

const patchSchema = z.object({
  id: z.number().int(),
  nombre: z.string().trim().min(1).max(60).optional(),
  descripcionCamas: z.string().trim().min(1).max(120).optional(),
  precioHabitacion: z.number().positive().optional(),
  precioPersona: z.number().positive().optional(),
  activa: z.boolean().optional(),
});

/** PATCH /api/habitaciones — actualizar tarifas desde /ajustes */
export async function PATCH(req: Request) {
  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const { id, ...data } = body.data;
  const habitacion = await prisma.habitacion.update({ where: { id }, data });
  return NextResponse.json(habitacion);
}
