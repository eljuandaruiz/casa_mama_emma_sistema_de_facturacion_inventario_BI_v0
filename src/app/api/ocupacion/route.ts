import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { listarOcupaciones } from '@/lib/ocupacion';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ocupacion?anio=2026&mes=7 — bloques de ocupación del mes (Reserva
 * + Factura) para pintar el calendario habitación × día.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const anio = Number(params.get('anio') ?? new Date().getFullYear());
  const mes = Number(params.get('mes') ?? new Date().getMonth() + 1); // 1..12

  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);

  const [habitaciones, ocupaciones] = await Promise.all([
    prisma.habitacion.findMany({ where: { activa: true }, orderBy: { numero: 'asc' } }),
    listarOcupaciones(desde, hasta),
  ]);

  return NextResponse.json({
    anio,
    mes,
    habitaciones: habitaciones.map((h) => ({ id: h.id, numero: h.numero, nombre: h.nombre })),
    ocupaciones,
  });
}
