import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const schema = z.object({ motivo: z.string().trim().min(3).max(300) });

/**
 * PATCH /api/facturas/:id/anular — marca la factura como anulada en el sistema
 * (se excluye de reportes e ingresos). IMPORTANTE: el SRI NO ofrece un web
 * service para anular; la anulación LEGAL se solicita en el portal del SRI
 * (SRI en línea → Facturación → Anulación de comprobantes), con plazos.
 * Este endpoint deja el registro y devuelve la guía del trámite.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Indica el motivo de la anulación (mín. 3 caracteres)' }, { status: 400 });
  }

  const factura = await prisma.factura.findUnique({ where: { id: params.id } });
  if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
  if (factura.anulada) return NextResponse.json({ error: 'La factura ya está anulada' }, { status: 409 });

  await prisma.factura.update({
    where: { id: params.id },
    data: { anulada: true, motivoAnulacion: parsed.data.motivo, fechaAnulacion: new Date() },
  });

  const guiaSri = factura.numeroAutorizacion
    ? 'Esta factura estaba AUTORIZADA. Para anularla legalmente, ingresa a SRI en línea → Facturación → Comprobantes electrónicos → Anulación, dentro del plazo permitido. El cliente debe aceptar la anulación.'
    : 'Esta factura no llegó a autorizarse en el SRI, por lo que basta con la anulación interna. No requiere trámite en el portal del SRI.';

  return NextResponse.json({ ok: true, guiaSri });
}
