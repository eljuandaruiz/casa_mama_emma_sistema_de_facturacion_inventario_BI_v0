/**
 * Catálogos oficiales del SRI — Ficha Técnica de Comprobantes
 * Electrónicos Esquema Offline (v2.3x). Solo se incluyen los códigos
 * que usa el negocio; ampliar aquí si se necesitan más.
 */

/** Tabla 4: tipo de comprobante */
export const TIPO_COMPROBANTE = { FACTURA: '01' } as const;

/** Tabla 2: tipo de emisión */
export const TIPO_EMISION = { NORMAL: '1' } as const;

/** Tabla 6: tipo de identificación del comprador */
export const TIPO_IDENTIFICACION = {
  RUC: '04',
  CEDULA: '05',
  PASAPORTE: '06',
  CONSUMIDOR_FINAL: '07',
  EXTERIOR: '08', // Identificación del Exterior (B2B extranjero: Airbnb, Booking…)
} as const;

export const CONSUMIDOR_FINAL_ID = '9999999999999';

/** Tabla 16/17: impuesto IVA y sus códigos de porcentaje vigentes 2026 */
export const IMPUESTO_IVA = '2';

export interface TarifaIva {
  codigoPorcentaje: string;
  tarifa: number;
  etiqueta: string;
}

export const TARIFAS_IVA: TarifaIva[] = [
  { codigoPorcentaje: '4', tarifa: 15, etiqueta: 'IVA 15% (tarifa general)' },
  { codigoPorcentaje: '8', tarifa: 8, etiqueta: 'IVA 8% (feriado turístico)' },
  { codigoPorcentaje: '0', tarifa: 0, etiqueta: 'IVA 0%' },
];

export const tarifaPorCodigo = (codigo: string): TarifaIva => {
  const t = TARIFAS_IVA.find((x) => x.codigoPorcentaje === codigo);
  if (!t) throw new Error(`Código de porcentaje IVA no soportado: ${codigo}`);
  return t;
};

/** Tabla 24: formas de pago */
export const FORMAS_PAGO = [
  { codigo: '01', etiqueta: 'Efectivo (sin sistema financiero)' },
  { codigo: '20', etiqueta: 'Transferencia bancaria' },
] as const;

/**
 * Validación de cédula ecuatoriana (algoritmo del dígito verificador, coeficientes
 * 2,1,2,1… sobre los 9 primeros dígitos; el 10º es el verificador).
 *
 * Rechaza explícitamente datos de relleno ("dummy") aunque pasaran el patrón,
 * para evitar que entren cédulas falsas evidentes a la base:
 *   - todos los dígitos iguales (0000000000, 2222222222…)
 *   - secuencias obvias (1234567890)
 * Estos, además, ya fallan el dígito verificador; la guarda lo hace explícito.
 */
export function validarCedula(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  // Rechazo de dummies: todos los dígitos iguales o la secuencia 1234567890.
  if (/^(\d)\1{9}$/.test(cedula)) return false;
  if (cedula === '1234567890' || cedula === '0123456789') return false;

  const provincia = Number(cedula.slice(0, 2));
  if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false;

  const digitos = cedula.split('').map(Number);
  const verificador = digitos.pop()!;
  const suma = digitos.reduce((acc, d, i) => {
    let v = i % 2 === 0 ? d * 2 : d;
    if (v > 9) v -= 9;
    return acc + v;
  }, 0);
  const calculado = (10 - (suma % 10)) % 10;
  return calculado === verificador;
}

/** Validación básica de RUC (13 dígitos terminados en 001 para personas naturales). */
export function validarRuc(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc)) return false;
  const tercerDigito = Number(ruc[2]);
  // Persona natural (0-5): los 10 primeros dígitos deben ser una cédula válida
  if (tercerDigito >= 0 && tercerDigito <= 5) {
    return validarCedula(ruc.slice(0, 10)) && ruc.endsWith('001');
  }
  // Sociedades (6, 9): validación de longitud + sufijo (módulo 11 completo opcional)
  return ruc.endsWith('001');
}

/**
 * Validación de identificación con MENSAJE DESCRIPTIVO según el tipo.
 * Devuelve `{ ok: true }` o `{ ok: false, error: 'motivo específico' }`.
 * Reglas:
 *   - Pasaporte (06): alfanumérico ^[A-Za-z0-9]+$, SIN módulo 11.
 *   - Cédula (05): exactamente 10 dígitos numéricos + módulo 10.
 *   - RUC (04): exactamente 13 dígitos numéricos + validación de estructura.
 *   - Consumidor final (07): siempre válido (id genérico 13 nueves).
 *   - Identificación del Exterior (08): alfanumérico, SIN validación local
 *     (entidad extranjera: Airbnb/Booking o turista con doc. del exterior).
 * Se usa en frontend (mensajes en vivo) y backend (rechazo) — misma fuente.
 */
export function validarIdentificacion(
  tipo: string,
  valor: string,
): { ok: true } | { ok: false; error: string } {
  const v = (valor ?? '').trim();

  if (tipo === TIPO_IDENTIFICACION.CONSUMIDOR_FINAL) return { ok: true };

  // Pasaporte (06) e Identificación del Exterior (08): alfanuméricos, sin módulo 11.
  if (tipo === TIPO_IDENTIFICACION.PASAPORTE || tipo === TIPO_IDENTIFICACION.EXTERIOR) {
    const etiqueta = tipo === TIPO_IDENTIFICACION.EXTERIOR ? 'la identificación del exterior' : 'el pasaporte';
    if (v.length === 0) return { ok: false, error: `Ingresa ${etiqueta}` };
    if (!/^[A-Za-z0-9-]+$/.test(v)) {
      return { ok: false, error: `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} contiene caracteres no permitidos` };
    }
    return { ok: true };
  }

  if (tipo === TIPO_IDENTIFICACION.CEDULA) {
    if (!/^\d+$/.test(v)) return { ok: false, error: 'La cédula solo puede contener números' };
    if (v.length !== 10) return { ok: false, error: 'La cédula debe contener exactamente 10 números' };
    if (!validarCedula(v)) return { ok: false, error: 'La cédula ingresada no es válida matemáticamente' };
    return { ok: true };
  }

  if (tipo === TIPO_IDENTIFICACION.RUC) {
    if (!/^\d+$/.test(v)) return { ok: false, error: 'El RUC solo puede contener números' };
    if (v.length !== 13) return { ok: false, error: 'El RUC debe contener exactamente 13 números' };
    if (!validarRuc(v)) return { ok: false, error: 'El RUC ingresado no es válido' };
    return { ok: true };
  }

  return { ok: false, error: 'Tipo de identificación no soportado' };
}

/** Valida un teléfono: solo dígitos (se permite vacío si es opcional). */
export function validarTelefono(valor: string): { ok: true } | { ok: false; error: string } {
  const v = (valor ?? '').trim();
  if (v.length === 0) return { ok: true };
  if (!/^[0-9]+$/.test(v)) {
    return { ok: false, error: 'El número de teléfono solo puede contener números enteros' };
  }
  return { ok: true };
}
