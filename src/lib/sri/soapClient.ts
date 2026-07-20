/**
 * Clientes SOAP para los Web Services del SRI (esquema offline):
 *  1. RecepcionComprobantesOffline  -> validarComprobante(xml base64)
 *  2. AutorizacionComprobantesOffline -> autorizacionComprobante(claveAcceso)
 *
 * Los servicios son SOAP 1.1 simples; se consumen con fetch + envelope
 * construido a mano y se parsea la respuesta con fast-xml-parser
 * (más liviano y auditable que un cliente SOAP completo).
 */
import { XMLParser } from 'fast-xml-parser';
import { SRI_URLS } from '@/lib/config';

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true, // soap:Envelope -> Envelope, ns2:respuesta... -> respuesta...
});

export interface MensajeSri {
  identificador?: string;
  mensaje?: string;
  informacionAdicional?: string;
  tipo?: string;
}

export interface RespuestaRecepcion {
  estado: 'RECIBIDA' | 'DEVUELTA' | 'ERROR';
  mensajes: MensajeSri[];
  crudo?: string;
}

export interface RespuestaAutorizacion {
  estado: 'AUTORIZADO' | 'NO AUTORIZADO' | 'EN PROCESO' | 'ERROR';
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  ambiente?: string;
  comprobanteXml?: string;
  mensajes: MensajeSri[];
  crudo?: string;
}

const asArray = <T>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

async function soapPost(url: string, body: string, timeoutMs = 30_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body,
      signal: controller.signal,
    });
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Paso 1: enviar el XML firmado al WS de Recepción. */
export async function enviarComprobante(
  xmlFirmado: string,
  ambiente: '1' | '2',
): Promise<RespuestaRecepcion> {
  const xmlBase64 = Buffer.from(xmlFirmado, 'utf8').toString('base64');
  const envelope =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">' +
    '<soapenv:Header/>' +
    '<soapenv:Body>' +
    '<ec:validarComprobante>' +
    `<xml>${xmlBase64}</xml>` +
    '</ec:validarComprobante>' +
    '</soapenv:Body>' +
    '</soapenv:Envelope>';

  try {
    const texto = await soapPost(SRI_URLS[ambiente].recepcion, envelope);
    const json = parser.parse(texto);
    const respuesta =
      json?.Envelope?.Body?.validarComprobanteResponse?.RespuestaRecepcionComprobante;
    if (!respuesta) return { estado: 'ERROR', mensajes: [{ mensaje: 'Respuesta SOAP inesperada' }], crudo: texto };

    const estado = respuesta.estado as 'RECIBIDA' | 'DEVUELTA';
    const mensajes: MensajeSri[] = asArray(
      respuesta?.comprobantes?.comprobante,
    ).flatMap((c: { mensajes?: { mensaje?: MensajeSri | MensajeSri[] } }) => asArray(c?.mensajes?.mensaje));
    return { estado, mensajes, crudo: texto };
  } catch (e) {
    return {
      estado: 'ERROR',
      mensajes: [{ mensaje: `No se pudo contactar al SRI (recepción): ${(e as Error).message}` }],
    };
  }
}

/** Paso 2: consultar la autorización por clave de acceso. */
export async function consultarAutorizacion(
  claveAcceso: string,
  ambiente: '1' | '2',
): Promise<RespuestaAutorizacion> {
  const envelope =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">' +
    '<soapenv:Header/>' +
    '<soapenv:Body>' +
    '<ec:autorizacionComprobante>' +
    `<claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>` +
    '</ec:autorizacionComprobante>' +
    '</soapenv:Body>' +
    '</soapenv:Envelope>';

  try {
    const texto = await soapPost(SRI_URLS[ambiente].autorizacion, envelope);
    const json = parser.parse(texto);
    const respuesta =
      json?.Envelope?.Body?.autorizacionComprobanteResponse?.RespuestaAutorizacionComprobante;
    const autorizaciones = asArray(respuesta?.autorizaciones?.autorizacion);
    if (autorizaciones.length === 0) {
      return {
        estado: 'EN PROCESO',
        mensajes: [{ mensaje: 'El SRI aún no registra autorización para esta clave de acceso' }],
        crudo: texto,
      };
    }
    const a = autorizaciones[0] as {
      estado: string;
      numeroAutorizacion?: string | number;
      fechaAutorizacion?: string;
      ambiente?: string;
      comprobante?: string;
      mensajes?: { mensaje?: MensajeSri | MensajeSri[] };
    };
    return {
      estado: (a.estado as RespuestaAutorizacion['estado']) ?? 'ERROR',
      numeroAutorizacion: a.numeroAutorizacion !== undefined ? String(a.numeroAutorizacion) : undefined,
      fechaAutorizacion: a.fechaAutorizacion,
      ambiente: a.ambiente,
      comprobanteXml: a.comprobante,
      mensajes: asArray(a?.mensajes?.mensaje),
      crudo: texto,
    };
  } catch (e) {
    return {
      estado: 'ERROR',
      mensajes: [{ mensaje: `No se pudo contactar al SRI (autorización): ${(e as Error).message}` }],
    };
  }
}
