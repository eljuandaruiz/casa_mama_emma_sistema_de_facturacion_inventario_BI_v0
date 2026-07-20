/**
 * Aritmética monetaria segura: todo cálculo interno se hace en CENTAVOS
 * (enteros) y solo se convierte a dólares con 2 decimales al final.
 * Evita los clásicos errores de coma flotante (0.1 + 0.2 ≠ 0.3).
 */

export const aCentavos = (usd: number): number => Math.round(usd * 100);

export const aDolares = (centavos: number): number => centavos / 100;

/** Redondeo comercial a 2 decimales (half-up, como exige el SRI). */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Formato "12.50" exigido por el XML del SRI (punto decimal, 2 dígitos). */
export const fmtSri = (n: number): string => round2(n).toFixed(2);

/** Formato de moneda para la UI: $1,234.50 */
export const fmtUsd = (n: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(round2(n));
