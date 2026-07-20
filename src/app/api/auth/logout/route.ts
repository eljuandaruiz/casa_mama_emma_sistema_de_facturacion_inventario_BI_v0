import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/auth/sesion';

export const dynamic = 'force-dynamic';

/** POST /api/auth/logout — borra la cookie de sesión. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE.nombre, '', { ...COOKIE.opciones, maxAge: 0 });
  return res;
}
