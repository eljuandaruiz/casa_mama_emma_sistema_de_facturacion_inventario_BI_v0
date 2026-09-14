import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/servidor';
import { ROLES } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

/** GET /api/usuarios — lista de usuarios (sin exponer el hash). */
export async function GET() {
  const usuarios = await prisma.usuario.findMany({ orderBy: { creadoEn: 'asc' } });
  return NextResponse.json(
    usuarios.map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      foto: u.foto,
      rol: u.rol,
      activo: u.activo,
      ultimoIngreso: u.ultimoIngreso,
    })),
  );
}

const crear = z.object({
  email: z.string().email(),
  nombre: z.string().trim().min(2).max(80),
  rol: z.enum([ROLES.ADMIN, ROLES.FACTURADOR, ROLES.OPERACIONES]),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

/** POST /api/usuarios — crea un usuario con su contraseña hasheada. */
export async function POST(req: Request) {
  const parsed = crear.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }
  const d = parsed.data;
  const existe = await prisma.usuario.findUnique({ where: { email: d.email.toLowerCase() } });
  if (existe) return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 });

  const u = await prisma.usuario.create({
    data: {
      email: d.email.toLowerCase(),
      nombre: d.nombre,
      rol: d.rol,
      passwordHash: await hashPassword(d.password),
      activo: true,
    },
  });
  return NextResponse.json({ id: u.id }, { status: 201 });
}

const editar = z.object({
  id: z.number().int(),
  rol: z.enum([ROLES.ADMIN, ROLES.FACTURADOR, ROLES.OPERACIONES]).optional(),
  activo: z.boolean().optional(),
  password: z.string().min(6).optional(),
  nombre: z.string().trim().min(2).max(80).optional(),
  foto: z.string().max(2_000_000).optional().or(z.literal('')),
});

/** PATCH /api/usuarios — cambia rol, nombre, foto, activa/desactiva o resetea contraseña. */
export async function PATCH(req: Request) {
  const parsed = editar.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const { id, rol, activo, password, nombre, foto } = parsed.data;

  const data: { rol?: string; activo?: boolean; passwordHash?: string; nombre?: string; foto?: string | null } = {};
  if (rol) data.rol = rol;
  if (typeof activo === 'boolean') data.activo = activo;
  if (password) data.passwordHash = await hashPassword(password);
  if (nombre) data.nombre = nombre;
  if (foto !== undefined) data.foto = foto === '' ? null : foto;

  const u = await prisma.usuario.update({ where: { id }, data });
  return NextResponse.json({ ok: true, id: u.id });
}
