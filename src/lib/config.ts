/** Configuración del emisor leída del entorno (.env). */
export const EMISOR = {
  ruc: process.env.SRI_RUC ?? '1805034426001',
  razonSocial: process.env.SRI_RAZON_SOCIAL ?? 'RUIZ JARA JUAN DAVID',
  nombreComercial: process.env.SRI_NOMBRE_COMERCIAL ?? 'Casa Mamá Emma',
  establecimiento: process.env.SRI_ESTABLECIMIENTO ?? '001',
  puntoEmision: process.env.SRI_PUNTO_EMISION ?? '001',
  /** "1" = pruebas (celcer) | "2" = producción (cel) */
  ambiente: (process.env.SRI_AMBIENTE ?? '1') as '1' | '2',
  obligadoContabilidad: process.env.SRI_OBLIGADO_CONTABILIDAD ?? 'NO',
  p12Path: process.env.SRI_P12_PATH ?? './certificados/firma.p12',
  p12Password: process.env.SRI_P12_PASSWORD ?? '',
  ivaCodigoDefecto: process.env.SRI_IVA_CODIGO_DEFECTO ?? '4',
  limiteConsumidorFinal: Number(process.env.SRI_LIMITE_CONSUMIDOR_FINAL ?? 50),
};

/**
 * Estado del certificado de firma (.p12). Solo Node (usa fs). Se usa en
 * /ajustes para avisar al admin si falta el certificado y en la firma real.
 */
export function estadoCertificado(): { existe: boolean; ruta: string; tieneClave: boolean } {
  // import diferido para no romper el bundle del cliente/Edge
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const ruta = path.isAbsolute(EMISOR.p12Path)
    ? EMISOR.p12Path
    : path.join(process.cwd(), EMISOR.p12Path);
  return {
    existe: fs.existsSync(ruta),
    ruta: EMISOR.p12Path,
    tieneClave: EMISOR.p12Password.length > 0,
  };
}

export const SRI_URLS = {
  '1': {
    recepcion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
    autorizacion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
  },
  '2': {
    recepcion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
    autorizacion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
  },
} as const;
