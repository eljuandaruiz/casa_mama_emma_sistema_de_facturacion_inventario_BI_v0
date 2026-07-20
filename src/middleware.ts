/**
 * MIDDLEWARE (runtime Edge) — puerta de acceso de toda la app:
 *  1. Deja pasar rutas públicas (login, assets, portal de huéspedes).
 *  2. Sin sesión válida  -> redirige a /login (páginas) o 401 (API).
 *  3. Con sesión pero sin el rol requerido -> 403 (API) o /sin-acceso (páginas).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, leerToken } from '@/lib/auth/sesion';
import { puedeAccederRuta } from '@/lib/auth/roles';

// Rutas accesibles sin sesión (el portal de huéspedes se añadirá en su módulo).
const PUBLICAS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/recuperar', // solicitar enlace de recuperación de contraseña
  '/api/auth/restablecer', // consumir el token y fijar nueva contraseña
  '/restablecer', // página pública para escribir la nueva contraseña
  '/portal',
  '/api/portal',
];

function esPublica(pathname: string): boolean {
  return PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (esPublica(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE.nombre)?.value;
  const sesion = await leerToken(token);
  const esApi = pathname.startsWith('/api');

  // 1) No autenticado
  if (!sesion) {
    if (esApi) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // 2) Autenticado pero sin permiso para esta sección
  if (!puedeAccederRuta(sesion.rol, pathname)) {
    if (esApi) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = '/sin-acceso';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * Excluye del middleware: assets estáticos de Next, favicon y archivos
 * públicos con extensión. Todo lo demás pasa por la guarda.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
