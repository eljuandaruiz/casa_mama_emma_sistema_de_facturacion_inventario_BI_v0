import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generarRide } from '@/lib/pdf/ride';
import { EMISOR } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** GET /api/facturas/:id/pdf — descarga el RIDE */
/** Limpia un texto para usarlo dentro del nombre de archivo. */
function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const factura = await prisma.factura.findUnique({
    where: { id: params.id },
    include: { detalles: { include: { habitacion: true } }, cliente: true, perfil: true },
  });
  if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

  const config = await prisma.configuracion.findUniqueOrThrow({ where: { id: 1 } });

  const pdf = await generarRide(factura, {
    ruc: EMISOR.ruc,
    razonSocial: EMISOR.razonSocial,
    nombreComercial: EMISOR.nombreComercial,
    dirMatriz: config.dirMatriz,
    dirEstablecimiento: config.dirEstablecimiento,
    obligadoContabilidad: config.obligadoContabilidad,
    ambiente: factura.ambiente,
    leyenda: config.leyendaRide,
  });

  // Nombre de archivo con datos para ordenar y analizar:
  //   numero_fecha_TIPO-nombre_habitacion_huespedes_genero_ingresos.pdf
  // TIPO es un acrónimo del documento del cliente para leerlo de un vistazo:
  //   CI = cédula, P = pasaporte, RUC = RUC, CF = consumidor final.
  const fecha = factura.fechaEmision.toISOString().slice(0, 10); // YYYY-MM-DD (ordena bien)
  const habNums = [...new Set(factura.detalles.map((d) => d.habitacion?.numero).filter(Boolean))].sort();
  const habTxt = habNums.length ? `hab${habNums.join('-')}` : 'casa';
  const genero = factura.perfil?.genero;
  const gTxt = genero === 'MASCULINO' ? 'M' : genero === 'FEMENINO' ? 'F' : genero ? 'X' : 'vacio';
  const ingresos = factura.importeTotal.toFixed(2);

  // Acrónimo del tipo de identificación (tabla 6 SRI).
  const ACRONIMO: Record<string, string> = { '04': 'RUC', '05': 'CI', '06': 'P', '07': 'CF' };
  const tipoDoc = ACRONIMO[factura.cliente.tipoIdentificacion] ?? 'DOC';
  // Si algún dato falta, se escribe "vacio" para que el nombre siga siendo legible.
  const nombreCliente = slug(factura.cliente.razonSocial) || 'vacio';

  const nombreArchivo =
    `${factura.numeroCompleto}_${fecha}_${tipoDoc}-${nombreCliente}_${habTxt}_${factura.huespedes}p_${gTxt}_${ingresos}usd.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      // inline para verlo en el navegador; el nombre se usa al "Guardar como".
      'Content-Disposition': `inline; filename="${nombreArchivo}"`,
    },
  });
}
