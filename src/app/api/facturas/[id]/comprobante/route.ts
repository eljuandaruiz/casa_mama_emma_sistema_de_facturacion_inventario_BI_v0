import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSesion } from '@/lib/auth/servidor';

export const dynamic = 'force-dynamic';

/**
 * COMPROBANTE DE TRANSFERENCIA — cuando el pago es por transferencia (20),
 * quien factura sube la FOTO del comprobante; el administrador la revisa
 * después desde la lista de facturas.
 *
 * La imagen se guarda en ./uploads/comprobantes/ (fuera de /public y de git)
 * y se sirve solo a usuarios autenticados vía el GET de esta misma ruta.
 */

const DIR = path.join(process.cwd(), 'uploads', 'comprobantes');

const schema = z.object({
  // Data-URL o base64 puro de un JPEG/PNG (el formulario ya reduce la foto).
  imagenBase64: z.string().min(100).max(8_000_000),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Imagen inválida' }, { status: 400 });

  const factura = await prisma.factura.findUnique({ where: { id: params.id } });
  if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

  // Acepta "data:image/jpeg;base64,..." o base64 pelado.
  const m = parsed.data.imagenBase64.match(/^data:image\/(png|jpe?g);base64,(.+)$/);
  const esPng = m?.[1] === 'png';
  const b64 = m ? m[2] : parsed.data.imagenBase64;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, 'base64');
  } catch {
    return NextResponse.json({ error: 'Base64 inválido' }, { status: 400 });
  }
  if (buffer.length < 100) return NextResponse.json({ error: 'Imagen vacía' }, { status: 400 });

  await fs.mkdir(DIR, { recursive: true });
  const nombre = `${factura.id}.${esPng ? 'png' : 'jpg'}`;
  await fs.writeFile(path.join(DIR, nombre), buffer);
  await prisma.factura.update({ where: { id: factura.id }, data: { pagoComprobante: nombre } });

  return NextResponse.json({ ok: true });
}

/** GET — devuelve la imagen (cualquier usuario autenticado; el middleware ya exige sesión). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sesion = await getSesion();
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const factura = await prisma.factura.findUnique({ where: { id: params.id } });
  if (!factura?.pagoComprobante) return NextResponse.json({ error: 'Sin comprobante' }, { status: 404 });

  try {
    const buffer = await fs.readFile(path.join(DIR, factura.pagoComprobante));
    const tipo = factura.pagoComprobante.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': tipo } });
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
}
