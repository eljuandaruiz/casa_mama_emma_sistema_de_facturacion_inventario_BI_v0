import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/clientes/buscar?identificacion=1710034065
 * Busca un cliente por su número de identificación exacto. Se usa para
 * AUTO-COMPLETAR el formulario de facturación cuando el huésped es recurrente:
 * si existe, devuelve sus datos (nombre, dirección, email, teléfono).
 * Devuelve null si no existe (huésped nuevo).
 *
 * Protegida por el middleware (ADMIN/FACTURADOR, prefijo /api/clientes no está
 * en la matriz => requiere sesión; ver nota abajo).
 */
export async function GET(req: Request) {
  const identificacion = new URL(req.url).searchParams.get('identificacion')?.trim();
  if (!identificacion || identificacion.length < 3) {
    return NextResponse.json(null);
  }
  const cliente = await prisma.cliente.findUnique({
    where: { identificacion },
    select: {
      tipoIdentificacion: true,
      identificacion: true,
      razonSocial: true,
      direccion: true,
      email: true,
      telefono: true,
      nacionalidad: true,
    },
  });
  return NextResponse.json(cliente);
}
