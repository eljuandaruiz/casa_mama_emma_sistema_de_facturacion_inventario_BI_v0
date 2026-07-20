/**
 * Leyenda legal que explica al huésped por qué la factura muestra un valor
 * MENOR al que pagó en Airbnb: se factura el neto que llega al anfitrión,
 * no el precio de plataforma (Airbnb retiene su comisión directamente).
 * Se imprime en español y en inglés en el RIDE para que el turista la entienda.
 */

export const LEYENDA_AIRBNB_ES =
  'Por disposición del SRI solo se factura el valor neto que recibe nuestro ' +
  'establecimiento. El monto total que usted visualiza en la plataforma incluye ' +
  'la comisión retenida directamente por Airbnb. Esta factura refleja ' +
  'exclusivamente nuestro servicio de hospedaje.';

export const LEYENDA_AIRBNB_EN =
  'By SRI regulation, only the net value received by our establishment is ' +
  'invoiced. The total amount you see on the platform includes the commission ' +
  'retained directly by Airbnb. This invoice exclusively reflects our lodging service.';

/** Detecta si la nota de una factura corresponde a la leyenda Airbnb. */
export function esNotaAirbnb(nota: string | null | undefined): boolean {
  return Boolean(nota && nota.includes('Por disposición del SRI'));
}
