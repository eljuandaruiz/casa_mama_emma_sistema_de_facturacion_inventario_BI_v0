import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { intercambiarCodigo, emailDeToken } from '@/lib/integraciones/google';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integraciones/google/callback?code=... — Google redirige aquí tras
 * el consentimiento. Guardamos el refresh token y volvemos a /integraciones.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const destino = new URL('/integraciones', url.origin);

  if (error || !code) {
    destino.searchParams.set('google', 'error');
    return NextResponse.redirect(destino);
  }

  const tokens = await intercambiarCodigo(code);
  if (!tokens.refresh_token) {
    // Sin refresh_token (p. ej. ya se había concedido): pedir de nuevo consent.
    destino.searchParams.set('google', 'sin_refresh');
    return NextResponse.redirect(destino);
  }

  const email = tokens.access_token ? await emailDeToken(tokens.access_token) : undefined;

  await prisma.integraciones.upsert({
    where: { id: 1 },
    update: { googleRefreshToken: tokens.refresh_token, googleConectadoEmail: email ?? null },
    create: { id: 1, googleRefreshToken: tokens.refresh_token, googleConectadoEmail: email ?? null },
  });

  destino.searchParams.set('google', 'ok');
  return NextResponse.redirect(destino);
}
