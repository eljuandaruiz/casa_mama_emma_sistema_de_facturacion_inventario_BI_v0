import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verificarPassword } from '@/lib/auth/servidor';
import { crearToken, COOKIE } from '@/lib/auth/sesion';
import { type Rol } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

// Política anti fuerza bruta: 10 intentos fallidos → bloqueo de 8 horas.
const MAX_INTENTOS = 10;
const BLOQUEO_MS = 8 * 60 * 60 * 1000;

// El login acepta un "identificador" que puede ser el nombre de USUARIO
// (preferido) o el email (compatibilidad). Se conserva `email` opcional por si
// algún cliente antiguo aún lo envía.
const schema = z.object({
  identificador: z.string().trim().min(1).optional(),
  email: z.string().optional(),
  password: z.string().min(1),
});

/** POST /api/auth/login — valida credenciales y emite la cookie de sesión. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  const { password } = parsed.data;
  const login = (parsed.data.identificador ?? parsed.data.email ?? '').trim();
  if (!login) return NextResponse.json({ error: 'Ingresa tu usuario' }, { status: 400 });

  // Busca por nombre de usuario (case-insensitive) o por email.
  const loginLower = login.toLowerCase();
  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ usuario: loginLower }, { email: loginLower }] },
  });

  // Mensaje genérico para no revelar si el usuario existe (anti-enumeración).
  const credencialesInvalidas = NextResponse.json(
    { error: 'Usuario o contraseña incorrectos' },
    { status: 401 },
  );
  if (!usuario || !usuario.activo) return credencialesInvalidas;

  // ---------- Anti fuerza bruta: bloqueo temporal ----------
  const ahora = new Date();
  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
    const min = Math.ceil((usuario.bloqueadoHasta.getTime() - ahora.getTime()) / 60000);
    return NextResponse.json(
      { error: `Cuenta bloqueada por demasiados intentos. Intenta en ${Math.ceil(min / 60)} hora(s) (${min} min) o recupera tu contraseña por correo.` },
      { status: 423 },
    );
  }

  const ok = await verificarPassword(password, usuario.passwordHash);
  if (!ok) {
    const intentos = usuario.intentosFallidos + 1;
    if (intentos >= MAX_INTENTOS) {
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MS) },
      });
      return NextResponse.json(
        { error: `Demasiados intentos fallidos (${MAX_INTENTOS}). La cuenta queda bloqueada por 8 horas. Puedes recuperar tu contraseña por correo.` },
        { status: 423 },
      );
    }
    await prisma.usuario.update({ where: { id: usuario.id }, data: { intentosFallidos: intentos } });
    const restantes = MAX_INTENTOS - intentos;
    return NextResponse.json(
      { error: `Usuario o contraseña incorrectos. Te quedan ${restantes} intento(s) antes del bloqueo.` },
      { status: 401 },
    );
  }

  // Login correcto: limpia el contador y cualquier bloqueo vencido.
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoIngreso: new Date(), intentosFallidos: 0, bloqueadoHasta: null },
  });

  const token = await crearToken({
    uid: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol as Rol,
  });

  const res = NextResponse.json({
    ok: true,
    usuario: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
  });
  res.cookies.set(COOKIE.nombre, token, COOKIE.opciones);
  return res;
}
