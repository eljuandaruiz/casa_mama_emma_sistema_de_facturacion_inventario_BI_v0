/**
 * CLAVE DE ACCESO (49 dígitos) — Ficha técnica SRI, esquema offline.
 *
 * Estructura:
 *  [1-8]   fecha emisión ddmmaaaa
 *  [9-10]  tipo de comprobante (01 = factura)
 *  [11-23] RUC del emisor
 *  [24]    ambiente (1 pruebas / 2 producción)
 *  [25-30] serie: establecimiento + punto de emisión
 *  [31-39] secuencial (9 dígitos)
 *  [40-47] código numérico (8 dígitos, aleatorio por comprobante)
 *  [48]    tipo de emisión (1 = normal)
 *  [49]    dígito verificador — módulo 11, pesos 2..7 de derecha a izquierda
 */

export interface DatosClave {
  fechaEmision: Date;
  tipoComprobante: string; // "01"
  ruc: string;
  ambiente: string; // "1" | "2"
  establecimiento: string; // "001"
  puntoEmision: string; // "001"
  secuencial: number; // 1 => "000000001"
  codigoNumerico?: string; // 8 dígitos; si no se pasa, se genera aleatorio
  tipoEmision?: string; // "1"
}

export function digitoVerificadorModulo11(cadena48: string): number {
  const pesos = [2, 3, 4, 5, 6, 7];
  let suma = 0;
  // Pesos aplicados de derecha a izquierda, ciclando 2..7
  const invertida = cadena48.split('').reverse();
  invertida.forEach((c, i) => {
    suma += Number(c) * pesos[i % 6];
  });
  const resto = suma % 11;
  const dv = 11 - resto;
  if (dv === 11) return 0;
  if (dv === 10) return 1;
  return dv;
}

export function generarClaveAcceso(d: DatosClave): string {
  const dd = String(d.fechaEmision.getDate()).padStart(2, '0');
  const mm = String(d.fechaEmision.getMonth() + 1).padStart(2, '0');
  const aaaa = String(d.fechaEmision.getFullYear());

  const codigoNumerico =
    d.codigoNumerico ?? String(Math.floor(Math.random() * 100_000_000)).padStart(8, '0');

  const base =
    dd +
    mm +
    aaaa +
    d.tipoComprobante +
    d.ruc +
    d.ambiente +
    d.establecimiento +
    d.puntoEmision +
    String(d.secuencial).padStart(9, '0') +
    codigoNumerico +
    (d.tipoEmision ?? '1');

  if (base.length !== 48) {
    throw new Error(`Clave base inválida: ${base.length} dígitos (esperados 48). Revise RUC/serie.`);
  }

  return base + String(digitoVerificadorModulo11(base));
}

/** Verifica una clave de acceso completa (49 dígitos). */
export function validarClaveAcceso(clave: string): boolean {
  if (!/^\d{49}$/.test(clave)) return false;
  return digitoVerificadorModulo11(clave.slice(0, 48)) === Number(clave[48]);
}

/** Fecha en formato dd/mm/aaaa exigido por <fechaEmision> del XML. */
export function fechaEmisionSri(fecha: Date): string {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${fecha.getFullYear()}`;
}
