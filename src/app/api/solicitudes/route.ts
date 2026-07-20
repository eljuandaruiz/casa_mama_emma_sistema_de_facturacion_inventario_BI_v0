import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/solicitudes?estado=PENDIENTE — bandeja de solicitudes del portal.
 * Protegida por el middleware (ADMIN/FACTURADOR).
 */
export async function GET(req: Request) {
  const estado = new URL(req.url).searchParams.get('estado') ?? 'PENDIENTE';
  const solicitudes = await prisma.solicitudHuesped.findMany({
    where: estado === 'TODAS' ? {} : { estado },
    orderBy: { creadoEn: 'desc' },
    take: 100,
  });
  return NextResponse.json(solicitudes);
}

const patch = z.object({
  id: z.number().int(),
  estado: z.enum(['PENDIENTE', 'USADA', 'DESCARTADA']),
});

/** PATCH /api/solicitudes — cambia el estado de una solicitud (descartar, etc.). */
export async function PATCH(req: Request) {
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const s = await prisma.solicitudHuesped.update({
    where: { id: parsed.data.id },
    data: { estado: parsed.data.estado },
  });
  return NextResponse.json(s);
}
