/**
 * Helpers de autenticación para el runtime de Node (páginas y rutas API):
 *  - hash / verificación de contraseñas con bcrypt
 *  - lectura de la sesión actual desde la cookie
 *  - guardas reutilizables (requiereSesion / requiereRol)
 */
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { COOKIE, leerToken, type SesionPayload } from './sesion';
import { type Rol } from './roles';

const RONDAS = 10;

export async function hashPassword(plano: string): Promise<string> {
  return bcrypt.hash(plano, RONDAS);
}

export async function verificarPassword(plano: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plano, hash);
}

/** Devuelve la sesión activa (o null) leyendo la cookie firmada. */
export async function getSesion(): Promise<SesionPayload | null> {
  const token = cookies().get(COOKIE.nombre)?.value;
  return leerToken(token);
}

/** Lanza si no hay sesión; úsalo en Server Components/acciones protegidas. */
export async function requiereSesion(): Promise<SesionPayload> {
  const s = await getSesion();
  if (!s) throw new Error('No autenticado');
  return s;
}

/** Lanza si la sesión no tiene uno de los roles permitidos (ADMIN siempre pasa). */
export async function requiereRol(...roles: Rol[]): Promise<SesionPayload> {
  const s = await requiereSesion();
  if (s.rol !== 'ADMIN' && !roles.includes(s.rol)) {
    throw new Error('No autorizado para esta acción');
  }
  return s;
}
