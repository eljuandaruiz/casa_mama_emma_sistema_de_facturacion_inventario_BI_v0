/**
 * RIDE (Representación Impresa del Documento Electrónico) con pdfmake.
 * Incluye: logo (o espacio reservado), datos del emisor, clave de acceso
 * con código de barras Code-128, número de autorización, detalle, totales
 * y línea de firma física.
 */
import path from 'node:path';
import fs from 'node:fs';
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import bwipjs from 'bwip-js/node';
import { fmtSri } from '@/lib/money';
import { fechaLarga, rangoFechas } from '@/lib/fechas';
import { esNotaAirbnb, LEYENDA_AIRBNB_EN } from '@/lib/sri/leyendaAirbnb';
import type { Factura, DetalleFactura, Cliente } from '@prisma/client';

// Fuentes estándar PDF (no requieren archivos .ttf)
const printer = new PdfPrinter({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

const ESTADOS_LEGIBLES: Record<string, string> = {
  AUTORIZADA: 'AUTORIZADO',
  NO_AUTORIZADA: 'NO AUTORIZADO',
  DEVUELTA: 'DEVUELTA POR EL SRI',
  EN_PROCESO: 'EN PROCESO DE AUTORIZACIÓN',
  RECIBIDA: 'RECIBIDA - PENDIENTE DE AUTORIZACIÓN',
  FIRMADA: 'FIRMADA - PENDIENTE DE ENVÍO',
  GENERADA: 'GENERADA',
  ERROR_ENVIO: 'PENDIENTE DE ENVÍO (SIN CONEXIÓN)',
  ERROR_FIRMA: 'ERROR DE FIRMA',
};

const FORMAS_PAGO_LEGIBLES: Record<string, string> = {
  '01': 'Efectivo',
  '20': 'Transferencia bancaria',
};

async function codigoBarras(claveAcceso: string): Promise<string> {
  const png = await bwipjs.toBuffer({
    bcid: 'code128',
    text: claveAcceso,
    scale: 2,
    height: 10,
    includetext: false,
  });
  return `data:image/png;base64,${png.toString('base64')}`;
}

export interface DatosEmisorRide {
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  dirMatriz: string;
  dirEstablecimiento: string;
  obligadoContabilidad: string;
  ambiente: string;
  leyenda?: string | null;
  /** Ruta a un PNG/JPG del logo; si no existe se dibuja un espacio reservado */
  logoPath?: string;
}

export async function generarRide(
  factura: Factura & { detalles: DetalleFactura[]; cliente: Cliente },
  emisor: DatosEmisorRide,
): Promise<Buffer> {
  const barcode = await codigoBarras(factura.claveAcceso);

  // Logo: usa public/logo.png si existe; si no, caja de marcador
  const logoAbs = emisor.logoPath ?? path.join(process.cwd(), 'public', 'logo.png');
  const logo: Content = fs.existsSync(logoAbs)
    ? { image: logoAbs, fit: [150, 70] }
    : {
        table: {
          widths: [150],
          body: [[{ text: '\n[ LOGO CASA MAMÁ EMMA ]\n', alignment: 'center', color: '#9ca3af', fontSize: 9 }]],
        },
        layout: { hLineColor: () => '#d1d5db', vLineColor: () => '#d1d5db' },
      };

  // Fecha de EMISIÓN en texto español ("14 de julio de 2026").
  const fechaTxt = fechaLarga(factura.fechaEmision);
  // Fechas de la ESTADÍA (reserva), si existen, también en texto.
  const rangoEstadiaTxt = rangoFechas(factura.checkIn, factura.checkOut);

  const filasDetalle: TableCell[][] = factura.detalles.map((d) => [
    { text: d.codigoPrincipal, fontSize: 8 },
    { text: d.descripcion, fontSize: 8 },
    { text: fmtSri(d.cantidad), alignment: 'right', fontSize: 8 },
    { text: fmtSri(d.precioUnitario), alignment: 'right', fontSize: 8 },
    { text: fmtSri(d.descuento), alignment: 'right', fontSize: 8 },
    { text: fmtSri(d.precioTotalSinImpuesto), alignment: 'right', fontSize: 8 },
  ]);

  const filaTotal = (etiqueta: string, valor: number, negrita = false): TableCell[] => [
    { text: etiqueta, fontSize: 8, bold: negrita },
    { text: `$ ${fmtSri(valor)}`, alignment: 'right', fontSize: 8, bold: negrita },
  ];

  const encabezadoDetalle: TableCell[] = [
    { text: 'Código', bold: true, fontSize: 8, fillColor: '#f3f4f6' },
    { text: 'Descripción', bold: true, fontSize: 8, fillColor: '#f3f4f6' },
    { text: 'Cant.', bold: true, fontSize: 8, fillColor: '#f3f4f6', alignment: 'right' },
    { text: 'P. Unitario', bold: true, fontSize: 8, fillColor: '#f3f4f6', alignment: 'right' },
    { text: 'Dscto.', bold: true, fontSize: 8, fillColor: '#f3f4f6', alignment: 'right' },
    { text: 'Total', bold: true, fontSize: 8, fillColor: '#f3f4f6', alignment: 'right' },
  ];

  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [36, 36, 36, 48],
    defaultStyle: { font: 'Helvetica', fontSize: 9 },
    content: [
      // ---------- Cabecera: logo/emisor + panel tributario ----------
      {
        columns: [
          {
            width: '48%',
            stack: [
              logo,
              { text: emisor.nombreComercial, bold: true, fontSize: 13, margin: [0, 8, 0, 2] },
              { text: emisor.razonSocial, fontSize: 9 },
              { text: `Matriz: ${emisor.dirMatriz}`, fontSize: 8, margin: [0, 4, 0, 0] },
              { text: `Establecimiento: ${emisor.dirEstablecimiento}`, fontSize: 8 },
              { text: `Obligado a llevar contabilidad: ${emisor.obligadoContabilidad}`, fontSize: 8, margin: [0, 4, 0, 0] },
            ],
          },
          {
            width: '52%',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: `R.U.C.: ${emisor.ruc}`, bold: true, fontSize: 11 },
                      { text: 'FACTURA', bold: true, fontSize: 13, margin: [0, 4, 0, 0] },
                      { text: `No. ${factura.numeroCompleto}`, fontSize: 11, margin: [0, 2, 0, 6] },
                      { text: 'NÚMERO DE AUTORIZACIÓN', bold: true, fontSize: 7 },
                      { text: factura.numeroAutorizacion ?? factura.claveAcceso, fontSize: 7.5, margin: [0, 1, 0, 4] },
                      {
                        text: `FECHA Y HORA AUTORIZACIÓN: ${factura.fechaAutorizacion ? factura.fechaAutorizacion.toLocaleString('es-EC') : 'PENDIENTE'}`,
                        fontSize: 7,
                      },
                      { text: `AMBIENTE: ${emisor.ambiente === '2' ? 'PRODUCCIÓN' : 'PRUEBAS'}`, fontSize: 7 },
                      { text: `EMISIÓN: NORMAL · ESTADO: ${ESTADOS_LEGIBLES[factura.estadoSri] ?? factura.estadoSri}`, fontSize: 7, margin: [0, 0, 0, 6] },
                      { text: 'CLAVE DE ACCESO', bold: true, fontSize: 7 },
                      { image: barcode, width: 240, margin: [0, 2, 0, 2] },
                      { text: factura.claveAcceso, fontSize: 7, alignment: 'center' },
                    ],
                    margin: [8, 8, 8, 8],
                  },
                ],
              ],
            },
            layout: { hLineColor: () => '#374151', vLineColor: () => '#374151' },
          },
        ],
        columnGap: 10,
      },

      // ---------- Datos del comprador ----------
      {
        margin: [0, 12, 0, 0],
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: `Razón Social / Nombres: ${factura.cliente.razonSocial}`, fontSize: 8 },
              { text: `Identificación: ${factura.cliente.identificacion}`, fontSize: 8 },
            ],
            [
              { text: `Fecha de emisión: ${fechaTxt}`, fontSize: 8 },
              { text: `Dirección: ${factura.cliente.direccion ?? '-'}`, fontSize: 8 },
            ],
            [
              { text: `Huéspedes: ${factura.huespedes} · Noches: ${factura.noches}`, fontSize: 8 },
              { text: `Forma de pago: ${FORMAS_PAGO_LEGIBLES[factura.formaPago] ?? factura.formaPago}`, fontSize: 8 },
            ],
            // Fechas de la estadía (reserva) en texto, si se registraron.
            ...(rangoEstadiaTxt
              ? [[
                  { text: `Fechas de reserva: ${rangoEstadiaTxt}`, fontSize: 8, colSpan: 2 },
                  {},
                ]]
              : []),
          ],
        },
        layout: { hLineColor: () => '#d1d5db', vLineColor: () => '#d1d5db' },
      },

      // ---------- Detalle ----------
      {
        margin: [0, 12, 0, 0],
        table: {
          headerRows: 1,
          widths: [55, '*', 35, 50, 45, 55],
          body: [encabezadoDetalle, ...filasDetalle],
        },
        layout: { hLineColor: () => '#d1d5db', vLineColor: () => '#d1d5db' },
      },

      // ---------- Totales ----------
      {
        margin: [0, 12, 0, 0],
        columns: [
          {
            width: '55%',
            stack: [
              // Nota de la factura (p. ej. desglose de comisión Airbnb).
              // Si es la leyenda Airbnb: recuadro oscuro y bien legible al
              // imprimir, con traducción al inglés para el turista.
              ...(factura.notaAdicional
                ? esNotaAirbnb(factura.notaAdicional)
                  ? [{
                      table: {
                        widths: ['*'],
                        body: [[{
                          stack: [
                            {
                              text: factura.notaAdicional,
                              fontSize: 8,
                              bold: true,
                              color: '#111827',
                              margin: [0, 0, 0, 4] as [number, number, number, number],
                            },
                            {
                              // Traducción con LOS MISMOS valores (generada al emitir);
                              // si la factura es antigua y no la tiene, cae al texto fijo.
                              text: factura.notaAdicionalEn ?? LEYENDA_AIRBNB_EN,
                              fontSize: 7.5,
                              italics: true,
                              color: '#1f2937',
                            },
                          ],
                          fillColor: '#f3f4f6',
                          margin: [6, 6, 6, 6] as [number, number, number, number],
                        }]],
                      },
                      layout: {
                        hLineColor: () => '#111827',
                        vLineColor: () => '#111827',
                        hLineWidth: () => 0.8,
                        vLineWidth: () => 0.8,
                      },
                      margin: [0, 0, 0, 8] as [number, number, number, number],
                    }]
                  : [{
                      text: factura.notaAdicional,
                      fontSize: 8,
                      bold: true,
                      color: '#111827',
                      margin: [0, 0, 0, 8] as [number, number, number, number],
                    }]
                : []),
              ...(emisor.leyenda
                ? [{ text: emisor.leyenda, italics: true, fontSize: 8, margin: [0, 0, 0, 8] as [number, number, number, number] }]
                : []),
              { text: 'Documento generado bajo el esquema offline de facturación electrónica del SRI.', fontSize: 7, color: '#6b7280' },
            ],
          },
          {
            width: '45%',
            table: {
              widths: ['*', 80],
              body: [
                filaTotal('SUBTOTAL SIN IMPUESTOS', factura.subtotalSinImpuestos),
                ...(factura.base15 > 0 ? [filaTotal('SUBTOTAL IVA 15%', factura.base15)] : []),
                ...(factura.base8 > 0 ? [filaTotal('SUBTOTAL IVA 8%', factura.base8)] : []),
                ...(factura.base0 > 0 ? [filaTotal('SUBTOTAL IVA 0%', factura.base0)] : []),
                filaTotal('DESCUENTO', factura.totalDescuento),
                filaTotal('IVA', factura.valorIva),
                filaTotal('PROPINA', factura.propina),
                filaTotal('VALOR TOTAL', factura.importeTotal, true),
              ],
            },
            layout: { hLineColor: () => '#d1d5db', vLineColor: () => '#d1d5db' },
          },
        ],
        columnGap: 10,
      },

      // ---------- Firma física ----------
      {
        margin: [0, 48, 0, 0],
        columns: [
          {
            width: '45%',
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.8 }] },
              { text: 'Firma autorizada · Casa Mamá Emma', fontSize: 8, margin: [0, 4, 0, 0] },
              { text: emisor.razonSocial, fontSize: 7, color: '#6b7280' },
            ],
          },
          { width: '10%', text: '' },
          {
            width: '45%',
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.8 }] },
              { text: 'Recibí conforme · Cliente', fontSize: 8, margin: [0, 4, 0, 0] },
            ],
          },
        ],
      },
    ],
    footer: (page, total) => ({
      text: `Casa Mamá Emma · Baños de Agua Santa · Página ${page} de ${total}`,
      alignment: 'center',
      fontSize: 7,
      color: '#9ca3af',
      margin: [0, 12, 0, 0],
    }),
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
