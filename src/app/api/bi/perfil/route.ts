import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/bi/perfil?facturaId=... — perfil demográfico de una factura (o null). */
export async function GET(req: Request) {
  const facturaId = new URL(req.url).searchParams.get('facturaId');
  if (!facturaId) return NextResponse.json({ error: 'Falta facturaId' }, { status: 400 });
  const perfil = await prisma.perfilHuesped.findUnique({ where: { facturaId } });
  return NextResponse.json(perfil);
}

// Campos opcionales: se guarda solo lo que se conozca. "" => null.
const vacioANull = (v: unknown) => (v === '' ? null : v);
const schema = z.object({
  facturaId: z.string().min(1),
  genero: z.preprocess(vacioANull, z.string().nullable().optional()),
  edad: z.preprocess(
    (v) => (v === '' || v == null ? null : Number(v)),
    z.number().int().min(0).max(120).nullable().optional(),
  ),
  nacionalidad: z.preprocess(vacioANull, z.string().nullable().optional()),
  paisResidencia: z.preprocess(vacioANull, z.string().nullable().optional()),
  profesion: z.preprocess(vacioANull, z.string().nullable().optional()),
  estadoRelacion: z.preprocess(vacioANull, z.string().nullable().optional()),
  segmentoViajero: z.preprocess(vacioANull, z.string().nullable().optional()),
  notas: z.preprocess(vacioANull, z.string().nullable().optional()),
});

/** POST /api/bi/perfil — crea o actualiza (upsert) el perfil de una factura. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalle: parsed.error.flatten() }, { status: 400 });
  }
  const { facturaId, ...datos } = parsed.data;

  const factura = await prisma.factura.findUnique({ where: { id: facturaId } });
  if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

  const perfil = await prisma.perfilHuesped.upsert({
    where: { facturaId },
    update: datos,
    create: { facturaId, ...datos },
  });
  return NextResponse.json(perfil, { status: 201 });
}
