/**
 * SESIÓN — cookie firmada (HMAC-SHA256) compatible con el runtime Edge
 * del middleware y con el runtime Node de las rutas/páginas.
 *
 * Formato de la cookie:  base64url(payloadJSON) + "." + base64url(HMAC)
 * El payload incluye una expiración; se rechaza cualquier cookie
 * manipulada (firma inválida) o caducada.
 *
 * Usa Web Crypto (globalThis.crypto.subtle), disponible tanto en Edge
 * como en Node 18+, por lo que NO depende de `node:crypto`.
 */
import { ROLES, type Rol } from './roles';

const NOMBRE_COOKIE = 'cme_sesion';
const DURACION_MS = 1000 * 60 * 60 * 8; // 8 horas

export interface SesionPayload {
  uid: number;
  email: string;
  nombre: string;
  rol: Rol;
  exp: number; // epoch ms
}

function secreto(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      'AUTH_SECRET no configurado (mínimo 16 caracteres). Añádelo a .env para poder iniciar sesión.',
    );
  }
  return s;
}

// ---------- helpers base64url (sin depender de Buffer para el Edge) ----------
function toB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const enc = new TextEncoder();

async function hmac(mensaje: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secreto()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(mensaje));
  return new Uint8Array(sig);
}

/** Comparación en tiempo constante para no filtrar la firma por timing. */
function iguales(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Serializa y firma una sesión. */
export async function crearToken(datos: Omit<SesionPayload, 'exp'>): Promise<string> {
  const payload: SesionPayload = { ...datos, exp: Date.now() + DURACION_MS };
  const cuerpo = toB64url(enc.encode(JSON.stringify(payload)));
  const firma = toB64url(await hmac(cuerpo));
  return `${cuerpo}.${firma}`;
}

/** Verifica firma + expiración. Devuelve la sesión o null. */
export async function leerToken(token: string | undefined): Promise<SesionPayload | null> {
  if (!token || !token.includes('.')) return null;
  const [cuerpo, firma] = token.split('.');
  try {
    const esperada = await hmac(cuerpo);
    if (!iguales(esperada, fromB64url(firma))) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(cuerpo))) as SesionPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    if (!Object.values(ROLES).includes(payload.rol)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const COOKIE = {
  nombre: NOMBRE_COOKIE,
  duracionMs: DURACION_MS,
  /** Opciones seguras para Set-Cookie. */
  opciones: {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(DURACION_MS / 1000),
  },
};
