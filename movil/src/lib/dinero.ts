/** Aritmética monetaria segura: cálculo interno en centavos, redondeo a 2 decimales. */
export const aCentavos = (usd: number): number => Math.round(usd * 100);
export const aDolares = (centavos: number): number => centavos / 100;
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
export const fmtUsd = (n: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(round2(n || 0));
