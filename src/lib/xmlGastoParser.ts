/**
 * LECTOR NATIVO DE XML — facturas ELECTRÓNICAS RECIBIDAS (gastos/compras a
 * proveedores). No usa ninguna API externa de pago: parsea el XML con
 * fast-xml-parser (misma librería ya usada para las respuestas SOAP del SRI).
 *
 * Acepta dos formatos de archivo, porque ambos circulan en la práctica:
 *   1. El XML "plano" de la factura: <factura version="1.1.0">…</factura>
 *   2. La respuesta de autorización del SRI, que envuelve la factura como
 *      CDATA dentro de <autorizacion><autorizaciones><autorizacion>
 *      <comprobante><![CDATA[<factura>…</factura>]]></comprobante>…
 *      (así es como muchos proveedores entregan el XML "autorizado").
 */
import { XMLParser } from 'fast-xml-parser';

// IMPORTANTE: parseTagValue:false — por defecto fast-xml-parser convierte
// texto numérico a Number, lo que TRUNCA CEROS A LA IZQUIERDA (estab "001"
// se vuelve 1) y CORROMPE la clave de acceso de 49 dígitos (se vuelve
// notación científica y pierde precisión). Se mantienen todos los valores
// como texto y se convierten a número explícitamente solo donde hace falta.
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false });

export interface GastoExtraido {
  proveedorNombre: string;
  proveedorRuc: string;
  numeroComprobante: string; // "001-001-000000123"
  claveAcceso?: string;
  fechaEmision: string; // ISO yyyy-mm-dd
  subtotal: number;
  iva: number;
  total: number;
  error?: string; // si el parseo falló parcialmente, se explica aquí
}

/** Convierte "dd/mm/aaaa" (formato SRI) a "aaaa-mm-dd" (ISO). */
function fechaSriAIso(fechaSri: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(fechaSri ?? '');
  if (!m) return new Date().toISOString().slice(0, 10);
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}`;
}

/** Extrae el bloque <factura>…</factura> desde un CDATA de <comprobante>, si aplica. */
function desenvolverComprobante(xmlTexto: string): string {
  const m = /<comprobante>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/comprobante>/.exec(xmlTexto);
  return m ? m[1] : xmlTexto;
}

/**
 * Parsea el texto de un archivo .xml de factura recibida y extrae los datos
 * clave para registrarlo como gasto. Nunca lanza: si algo falta, lo indica en
 * `error` para que la fila se muestre igual (editable) en la tabla de revisión.
 */
export function parseGastoXml(xmlTexto: string, nombreArchivo: string): GastoExtraido {
  const base: GastoExtraido = {
    proveedorNombre: '',
    proveedorRuc: '',
    numeroComprobante: '',
    fechaEmision: new Date().toISOString().slice(0, 10),
    subtotal: 0,
    iva: 0,
    total: 0,
  };

  try {
    const xmlInterno = desenvolverComprobante(xmlTexto);
    const doc = parser.parse(xmlInterno);
    const factura = doc?.factura;
    if (!factura) {
      return { ...base, error: `${nombreArchivo}: no se encontró la etiqueta <factura>` };
    }

    const infoTrib = factura.infoTributaria ?? {};
    const infoFact = factura.infoFactura ?? {};

    const proveedorNombre = String(infoTrib.razonSocial ?? infoTrib.nombreComercial ?? '').trim();
    const proveedorRuc = String(infoTrib.ruc ?? '').trim();
    // estab/ptoEmi/secuencial llegan como texto (parseTagValue:false evita que
    // se pierdan los ceros a la izquierda); se re-normaliza el padding por si
    // el emisor los mandó sin rellenar.
    const estab = String(infoTrib.estab ?? '').padStart(3, '0');
    const ptoEmi = String(infoTrib.ptoEmi ?? '').padStart(3, '0');
    const secuencialRaw = String(infoTrib.secuencial ?? '');
    const secuencial = secuencialRaw.padStart(9, '0');
    const numeroComprobante =
      infoTrib.estab && infoTrib.ptoEmi && secuencialRaw ? `${estab}-${ptoEmi}-${secuencial}` : '';

    const totalSinImpuestos = Number(infoFact.totalSinImpuestos ?? 0);
    const importeTotal = Number(infoFact.importeTotal ?? 0);

    // El IVA puede venir en uno o varios totalImpuesto (múltiples tarifas).
    let ivaTotal = 0;
    const totalImp = infoFact.totalConImpuestos?.totalImpuesto;
    const lista = Array.isArray(totalImp) ? totalImp : totalImp ? [totalImp] : [];
    for (const t of lista) ivaTotal += Number(t?.valor ?? 0);
    // Si no hay desglose de impuestos, se infiere como total − subtotal.
    if (lista.length === 0 && importeTotal && totalSinImpuestos) {
      ivaTotal = Math.max(0, importeTotal - totalSinImpuestos);
    }

    const faltantes: string[] = [];
    if (!proveedorRuc) faltantes.push('RUC del proveedor');
    if (!numeroComprobante) faltantes.push('número de comprobante');

    return {
      proveedorNombre: proveedorNombre || 'Proveedor sin nombre',
      proveedorRuc,
      numeroComprobante,
      claveAcceso: infoTrib.claveAcceso ? String(infoTrib.claveAcceso) : undefined,
      fechaEmision: fechaSriAIso(String(infoFact.fechaEmision ?? '')),
      subtotal: Math.round(totalSinImpuestos * 100) / 100,
      iva: Math.round(ivaTotal * 100) / 100,
      total: Math.round((importeTotal || totalSinImpuestos + ivaTotal) * 100) / 100,
      error: faltantes.length ? `${nombreArchivo}: falta ${faltantes.join(' y ')} — revisa antes de guardar` : undefined,
    };
  } catch (e) {
    return { ...base, error: `${nombreArchivo}: XML no se pudo leer (${(e as Error).message})` };
  }
}
