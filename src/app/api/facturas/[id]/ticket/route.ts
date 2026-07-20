import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generarTicket } from '@/lib/pdf/ticket';
import { EMISOR } from '@/lib/config';
import { fechaArchivo, rangoArchivo } from '@/lib/fechas';

export const dynamic = 'force-dynamic';

/** Limpia un texto para usarlo en el nombre de archivo. */
function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(0, 30);
}

/**
 * GET /api/facturas/:id/ticket — comprobante térmico (rollo 80 mm).
 * Nombre del archivo (convención estricta, igual que el A4 + fechas de estadía):
 *   Ticket_[Num]_[FechaEmision]_[ID]_[Nombre]_[Habs]_[Estadia]_[Total].pdf
 *   Ej: Ticket_001-001-000000001_14-julio-2026_1800000000_JuanDoe_hab2_13-al-14-julio_150.00.pdf
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const factura = await prisma.factura.findUnique({
    where: { id: params.id },
    include: { detalles: { include: { habitacion: true } }, cliente: true },
  });
  if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

  const config = await prisma.configuracion.findUniqueOrThrow({ where: { id: 1 } });

  const pdf = await generarTicket(factura, {
    ruc: EMISOR.ruc,
    razonSocial: EMISOR.razonSocial,
    nombreComercial: EMISOR.nombreComercial,
    dirEstablecimiento: config.dirEstablecimiento,
    ambiente: factura.ambiente,
  });

  // --- Construcción del nombre de archivo ---
  const emision = fechaArchivo(factura.fechaEmision);
  const habNums = [...new Set(factura.detalles.map((d) => d.habitacion?.numero).filter(Boolean))].sort();
  const habTxt = habNums.length ? `hab${habNums.join('-')}` : 'casa';
  const estadia = rangoArchivo(factura.checkIn, factura.checkOut);
  const nombre = slug(factura.cliente.razonSocial) || 'vacio';
  const total = factura.importeTotal.toFixed(2);

  const nombreArchivo =
    `Ticket_${factura.numeroCompleto}_${emision}_${factura.cliente.identificacion}_${nombre}_${habTxt}_${estadia}_${total}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nombreArchivo}"`,
    },
  });
}
