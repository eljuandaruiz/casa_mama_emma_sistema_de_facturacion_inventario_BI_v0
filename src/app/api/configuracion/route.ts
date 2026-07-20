import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/configuracion — direcciones y leyenda (editable en /ajustes) */
export async function GET() {
  const config = await prisma.configuracion.findUnique({ where: { id: 1 } });
  return NextResponse.json(config);
}

const schema = z.object({
  dirMatriz: z.string().min(3).optional(),
  dirEstablecimiento: z.string().min(3).optional(),
  obligadoContabilidad: z.enum(['SI', 'NO']).optional(),
  telefono: z.string().optional(),
  emailEmisor: z.string().email().optional().or(z.literal('')),
  leyendaRide: z.string().optional(),
  // Código de referencia de la factura: 3 dígitos cada uno (o vacío = usar .env).
  establecimiento: z.string().regex(/^\d{3}$/, 'Debe ser 3 dígitos, ej. 001').optional().or(z.literal('')),
  puntoEmision: z.string().regex(/^\d{3}$/, 'Debe ser 3 dígitos, ej. 001').optional().or(z.literal('')),
});

/** PATCH /api/configuracion */
export async function PATCH(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const config = await prisma.configuracion.update({
    where: { id: 1 },
    data: {
      ...parsed.data,
      emailEmisor: parsed.data.emailEmisor || undefined,
      // '' → null para que caiga al valor del .env.
      establecimiento: parsed.data.establecimiento === '' ? null : parsed.data.establecimiento,
      puntoEmision: parsed.data.puntoEmision === '' ? null : parsed.data.puntoEmision,
    },
  });
  return NextResponse.json(config);
}
