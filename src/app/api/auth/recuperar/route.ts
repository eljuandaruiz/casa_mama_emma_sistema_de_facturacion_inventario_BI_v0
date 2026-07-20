import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { enviarCorreoRecuperacion, smtpConfigurado } from '@/lib/email';

export const dynamic = 'force-dynamic';

const TOKEN_VIGENCIA_MS = 60 * 60 * 1000; // 1 hora

const schema = z.object({ identificador: z.string().trim().min(1) });

/**
 * POST /api/auth/recuperar — inicia la recuperación tradicional por correo:
 * genera un token de un solo uso (1 h) y envía el enlace al email del usuario.
 * SIEMPRE responde lo mismo exista o no el usuario (anti-enumeración).
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  if (!smtpConfigurado()) {
    return NextResponse.json(
      { error: 'El envío de correo (SMTP) no está configurado en el servidor. Pide al administrador restablecer tu clave desde /usuarios.' },
      { status: 503 },
    );
  }

  const login = parsed.data.identificador.toLowerCase();
  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ usuario: login }, { email: login }], activo: true },
  });

  // Respuesta idéntica exista o no (no revelar qué usuarios existen).
  const respuestaGenerica = NextResponse.json({
    ok: true,
    mensaje: 'Si el usuario existe, enviamos un enlace de recuperación a su correo (revisa spam).',
  });
  if (!usuario) return respuestaGenerica;

  const token = randomBytes(32).toString('hex');
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { resetToken: token, resetTokenExp: new Date(Date.now() + TOKEN_VIGENCIA_MS) },
  });

  const base = process.env.APP_URL || 'http://localhost:3000';
  const enlace = `${base}/restablecer?token=${token}`;
  // Best-effort: si el correo falla, no revelamos detalles al cliente.
  void enviarCorreoRecuperacion(usuario.email, usuario.nombre, enlace).catch(() => {});

  return respuestaGenerica;
}
