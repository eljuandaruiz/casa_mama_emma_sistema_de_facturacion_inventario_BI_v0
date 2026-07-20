import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/contactos — contactos guardados (trabajadores, proveedores). */
export async function GET() {
  const contactos = await prisma.contacto.findMany({ orderBy: { nombre: 'asc' } });
  return NextResponse.json(contactos);
}

const schema = z.object({
  nombre: z.string().trim().min(2).max(80),
  telefono: z.string().trim().max(30).optional().or(z.literal('')),
  oficio: z.string().trim().max(40).optional().or(z.literal('')),
});

/** POST /api/contactos — crea un contacto (evita duplicar por nombre exacto). */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const d = parsed.data;

  const existente = await prisma.contacto.findFirst({ where: { nombre: d.nombre } });
  if (existente) {
    const act = await prisma.contacto.update({
      where: { id: existente.id },
      data: { telefono: d.telefono || existente.telefono, oficio: d.oficio || existente.oficio },
    });
    return NextResponse.json(act);
  }
  const c = await prisma.contacto.create({
    data: { nombre: d.nombre, telefono: d.telefono || null, oficio: d.oficio || null },
  });
  return NextResponse.json(c, { status: 201 });
}
