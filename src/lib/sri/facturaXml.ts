/**
 * Generación del XML <factura> versión 1.1.0 según la Ficha Técnica del SRI
 * (esquema offline). El XML se construye ya en forma "canónica amigable"
 * (sin tags auto-cerrados, atributos en orden fijo, sin espacios extra)
 * para que la firma XAdES-BES calcule digests estables.
 */
import { fmtSri } from '@/lib/money';
import { IMPUESTO_IVA } from '@/lib/sri/catalogos';
import { fechaEmisionSri } from '@/lib/sri/claveAcceso';

export interface DetalleXml {
  codigoPrincipal: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotalSinImpuesto: number;
  codigoPorcentaje: string; // "4" | "8" | "0"
  tarifa: number; // 15 | 8 | 0
  valorIva: number;
}

export interface TotalImpuestoXml {
  codigoPorcentaje: string;
  baseImponible: number;
  valor: number;
}

export interface FacturaXmlInput {
  // infoTributaria
  ambiente: string;
  razonSocial: string;
  nombreComercial: string;
  ruc: string;
  claveAcceso: string;
  establecimiento: string;
  puntoEmision: string;
  secuencial: number;
  dirMatriz: string;
  // infoFactura
  fechaEmision: Date;
  dirEstablecimiento: string;
  obligadoContabilidad: string; // "SI" | "NO"
  tipoIdentificacionComprador: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  direccionComprador?: string;
  totalSinImpuestos: number;
  totalDescuento: number;
  totalImpuestos: TotalImpuestoXml[];
  propina: number;
  importeTotal: number;
  formaPago: string; // "01" | "20"
  // detalles
  detalles: DetalleXml[];
  // infoAdicional
  camposAdicionales?: { nombre: string; valor: string }[];
}

/** Escapado XML obligatorio (el SRI rechaza entidades mal formadas). */
export const escapeXml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const tag = (nombre: string, valor: string | number): string =>
  `<${nombre}>${typeof valor === 'number' ? valor : escapeXml(valor)}</${nombre}>`;

export function construirFacturaXml(f: FacturaXmlInput): string {
  const secuencial9 = String(f.secuencial).padStart(9, '0');

  const infoTributaria =
    '<infoTributaria>' +
    tag('ambiente', f.ambiente) +
    tag('tipoEmision', '1') +
    tag('razonSocial', f.razonSocial) +
    tag('nombreComercial', f.nombreComercial) +
    tag('ruc', f.ruc) +
    tag('claveAcceso', f.claveAcceso) +
    tag('codDoc', '01') +
    tag('estab', f.establecimiento) +
    tag('ptoEmi', f.puntoEmision) +
    tag('secuencial', secuencial9) +
    tag('dirMatriz', f.dirMatriz) +
    '</infoTributaria>';

  const totalConImpuestos =
    '<totalConImpuestos>' +
    f.totalImpuestos
      .map(
        (t) =>
          '<totalImpuesto>' +
          tag('codigo', IMPUESTO_IVA) +
          tag('codigoPorcentaje', t.codigoPorcentaje) +
          tag('baseImponible', fmtSri(t.baseImponible)) +
          tag('valor', fmtSri(t.valor)) +
          '</totalImpuesto>',
      )
      .join('') +
    '</totalConImpuestos>';

  const pagos =
    '<pagos>' +
    '<pago>' +
    tag('formaPago', f.formaPago) +
    tag('total', fmtSri(f.importeTotal)) +
    '</pago>' +
    '</pagos>';

  const infoFactura =
    '<infoFactura>' +
    tag('fechaEmision', fechaEmisionSri(f.fechaEmision)) +
    tag('dirEstablecimiento', f.dirEstablecimiento) +
    tag('obligadoContabilidad', f.obligadoContabilidad) +
    tag('tipoIdentificacionComprador', f.tipoIdentificacionComprador) +
    tag('razonSocialComprador', f.razonSocialComprador) +
    tag('identificacionComprador', f.identificacionComprador) +
    (f.direccionComprador ? tag('direccionComprador', f.direccionComprador) : '') +
    tag('totalSinImpuestos', fmtSri(f.totalSinImpuestos)) +
    tag('totalDescuento', fmtSri(f.totalDescuento)) +
    totalConImpuestos +
    tag('propina', fmtSri(f.propina)) +
    tag('importeTotal', fmtSri(f.importeTotal)) +
    tag('moneda', 'DOLAR') +
    pagos +
    '</infoFactura>';

  const detalles =
    '<detalles>' +
    f.detalles
      .map(
        (d) =>
          '<detalle>' +
          tag('codigoPrincipal', d.codigoPrincipal) +
          tag('descripcion', d.descripcion) +
          tag('cantidad', fmtSri(d.cantidad)) +
          tag('precioUnitario', fmtSri(d.precioUnitario)) +
          tag('descuento', fmtSri(d.descuento)) +
          tag('precioTotalSinImpuesto', fmtSri(d.precioTotalSinImpuesto)) +
          '<impuestos>' +
          '<impuesto>' +
          tag('codigo', IMPUESTO_IVA) +
          tag('codigoPorcentaje', d.codigoPorcentaje) +
          tag('tarifa', fmtSri(d.tarifa)) +
          tag('baseImponible', fmtSri(d.precioTotalSinImpuesto)) +
          tag('valor', fmtSri(d.valorIva)) +
          '</impuesto>' +
          '</impuestos>' +
          '</detalle>',
      )
      .join('') +
    '</detalles>';

  const camposAdic = f.camposAdicionales?.length
    ? '<infoAdicional>' +
      f.camposAdicionales
        .map((c) => `<campoAdicional nombre="${escapeXml(c.nombre)}">${escapeXml(c.valor)}</campoAdicional>`)
        .join('') +
      '</infoAdicional>'
    : '';

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<factura id="comprobante" version="1.1.0">' +
    infoTributaria +
    infoFactura +
    detalles +
    camposAdic +
    '</factura>'
  );
}
