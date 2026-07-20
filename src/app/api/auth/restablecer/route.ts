import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/servidor';

export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(32),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

/**
 * POST /api/auth/restablecer — consume el token de recuperación (un solo uso,
 * 1 h de vigencia) y fija la nueva contraseña. También levanta cualquier
 * bloqueo por intentos fallidos.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Datos inválidos';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const { token, password } = parsed.data;

  const usuario = await prisma.usuario.findUnique({ where: { resetToken: token } });
  if (!usuario || !usuario.resetTokenExp || usuario.resetTokenExp < new Date()) {
    return NextResponse.json(
      { error: 'El enlace de recuperación es inválido o ya expiró. Solicita uno nuevo.' },
      { status: 400 },
    );
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      passwordHash: await hashPassword(password),
      resetToken: null,
      resetTokenExp: null,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
  });

  return NextResponse.json({ ok: true, mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
}
