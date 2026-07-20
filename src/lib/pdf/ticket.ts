/**
 * COMPROBANTE TÉRMICO (rollo 80 mm) — versión compacta de la factura para
 * impresoras de tickets (las de supermercado). Ancho fijo ~80 mm, alto
 * dinámico. Mantiene los datos clave: emisor, número, cliente, detalle,
 * totales y clave de acceso.
 */
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { fmtSri } from '@/lib/money';
import { fechaLarga, rangoFechas } from '@/lib/fechas';
import type { Factura, DetalleFactura, Cliente } from '@prisma/client';

const printer = new PdfPrinter({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

// 80 mm = 226.77 pt. Margen mínimo a los lados.
const ANCHO_TICKET = 226;

export interface EmisorTicket {
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  dirEstablecimiento: string;
  ambiente: string;
}

export async function generarTicket(
  factura: Factura & { detalles: DetalleFactura[]; cliente: Cliente },
  emisor: EmisorTicket,
): Promise<Buffer> {
  const linea = (): Content => ({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: ANCHO_TICKET - 20, y2: 0, lineWidth: 0.5, dash: { length: 2 } }],
    margin: [0, 3, 0, 3],
  });

  // Fecha de emisión en texto español; rango de reserva si existe.
  const fecha = fechaLarga(factura.fechaEmision);
  const rangoEstadia = rangoFechas(factura.checkIn, factura.checkOut);

  // Línea machine-readable (para inteligencia posterior). Orden EXACTO:
  // ID_Nombre_TipoHospedaje_ValorUnitario_Total_Descuento_FormaPago
  // (campos separados por "_"; espacios internos → "-").
  const compacto = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
  const tipoHospedaje = compacto(factura.detalles[0]?.descripcion ?? 'HOSPEDAJE');
  const valorUnit = fmtSri(factura.detalles[0]?.precioUnitario ?? factura.subtotalSinImpuestos);
  const formaPagoTxt = factura.formaPago === '01' ? 'EFECTIVO' : 'TRANSFERENCIA';
  const lineaDatos = [
    factura.numeroCompleto,
    compacto(factura.cliente.razonSocial),
    tipoHospedaje,
    valorUnit,
    fmtSri(factura.importeTotal),
    fmtSri(factura.totalDescuento),
    formaPagoTxt,
  ].join('_');

  const detalleContent: Content[] = factura.detalles.map((d) => ({
    columns: [
      { text: `${fmtSri(d.cantidad)}x ${d.descripcion}`, fontSize: 7, width: '*' },
      { text: `$${fmtSri(d.precioTotalSinImpuesto)}`, fontSize: 7, width: 'auto', alignment: 'right' },
    ],
    columnGap: 4,
    margin: [0, 1, 0, 0],
  }));

  const totalRow = (etiqueta: string, valor: number, negrita = false): Content => ({
    columns: [
      { text: etiqueta, fontSize: negrita ? 9 : 7, bold: negrita, width: '*' },
      { text: `$${fmtSri(valor)}`, fontSize: negrita ? 9 : 7, bold: negrita, width: 'auto', alignment: 'right' },
    ],
    margin: [0, 1, 0, 0],
  });

  const doc: TDocumentDefinitions = {
    // Alto grande; pdfmake recorta al contenido con pageSize dinámico no es
    // trivial, así que usamos un alto amplio y el rollo corta al final.
    pageSize: { width: ANCHO_TICKET, height: 800 },
    pageMargins: [10, 10, 10, 10],
    defaultStyle: { font: 'Helvetica', fontSize: 8 },
    content: [
      { text: emisor.nombreComercial, bold: true, fontSize: 11, alignment: 'center' },
      { text: emisor.razonSocial, fontSize: 7, alignment: 'center' },
      { text: `RUC: ${emisor.ruc}`, fontSize: 7, alignment: 'center' },
      { text: emisor.dirEstablecimiento, fontSize: 6.5, alignment: 'center', color: '#444' },
      { text: emisor.ambiente === '2' ? '' : '*** AMBIENTE DE PRUEBAS ***', fontSize: 6.5, alignment: 'center', color: '#b45309' },
      linea(),
      { text: 'FACTURA', bold: true, fontSize: 9, alignment: 'center' },
      { text: factura.numeroCompleto, fontSize: 8, alignment: 'center' },
      { text: `Emitida: ${fecha}`, fontSize: 7, alignment: 'center', color: '#444' },
      ...(rangoEstadia
        ? [{ text: `Reserva: ${rangoEstadia}`, fontSize: 7, alignment: 'center' as const, color: '#444' }]
        : []),
      linea(),
      { text: `Cliente: ${factura.cliente.razonSocial}`, fontSize: 7 },
      { text: `ID: ${factura.cliente.identificacion}`, fontSize: 7 },
      linea(),
      ...detalleContent,
      linea(),
      totalRow('Subtotal', factura.subtotalSinImpuestos),
      ...(factura.totalDescuento > 0 ? [totalRow('Descuento', factura.totalDescuento)] : []),
      totalRow('IVA', factura.valorIva),
      ...(factura.propina > 0 ? [totalRow('Propina', factura.propina)] : []),
      totalRow('TOTAL', factura.importeTotal, true),
      linea(),
      { text: 'CLAVE DE ACCESO', fontSize: 6.5, bold: true, alignment: 'center', margin: [0, 2, 0, 0] },
      { text: factura.claveAcceso, fontSize: 6, alignment: 'center', characterSpacing: -0.2 },
      ...(factura.numeroAutorizacion
        ? [{ text: `Autorización: ${factura.numeroAutorizacion}`, fontSize: 6, alignment: 'center' as const, margin: [0, 2, 0, 0] as [number, number, number, number] }]
        : []),
      // Disclaimer legal (p. ej. Airbnb) si la factura lo tiene registrado.
      ...(factura.notaAdicional
        ? [linea(), { text: factura.notaAdicional, fontSize: 6, alignment: 'justify' as const, color: '#444' }]
        : []),
      { text: '¡Gracias por su visita!', fontSize: 8, alignment: 'center', margin: [0, 6, 0, 0] },
      // Línea MACHINE-READABLE (misma convención del nombre de archivo):
      // campos separados por "_" para poder hacer inteligencia después:
      // NUM_CLIENTE_CONCEPTO_VALORUNIT_DESCUENTO_TOTAL_FORMAPAGO
      linea(),
      { text: lineaDatos, fontSize: 5, alignment: 'center', color: '#666', characterSpacing: -0.2 },
    ],
  };

  return new Promise<Buffer>((resolve, reject) => {
    const pdf = printer.createPdfKitDocument(doc);
    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.end();
  });
}
