/**
 * Formateo de fechas en ESPAÑOL con el mes escrito (no puramente numérico),
 * para los PDF y tickets. Requisito legal/estético del negocio.
 *
 *   fechaLarga(2026-07-14)         -> "14 de julio de 2026"
 *   rangoFechas(13/jul, 14/jul)    -> "del 13 al 14 de julio de 2026"
 *   fechaArchivo(2026-07-14)       -> "14-julio-2026"  (para nombres de archivo)
 */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "14 de julio de 2026" */
export function fechaLarga(fecha: Date): string {
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

/**
 * Rango de estadía en texto. Compacta cuando comparten mes/año:
 *   mismo mes  -> "del 13 al 14 de julio de 2026"
 *   distinto   -> "del 30 de julio al 2 de agosto de 2026"
 */
export function rangoFechas(inicio: Date | null | undefined, fin: Date | null | undefined): string {
  if (!inicio && !fin) return '';
  if (inicio && !fin) return `desde el ${fechaLarga(inicio)}`;
  if (!inicio && fin) return `hasta el ${fechaLarga(fin)}`;
  const i = inicio as Date;
  const f = fin as Date;
  if (i.getMonth() === f.getMonth() && i.getFullYear() === f.getFullYear()) {
    return `del ${i.getDate()} al ${f.getDate()} de ${MESES[i.getMonth()]} de ${i.getFullYear()}`;
  }
  if (i.getFullYear() === f.getFullYear()) {
    return `del ${i.getDate()} de ${MESES[i.getMonth()]} al ${f.getDate()} de ${MESES[f.getMonth()]} de ${i.getFullYear()}`;
  }
  return `del ${fechaLarga(i)} al ${fechaLarga(f)}`;
}

/** "14-julio-2026" — para nombres de archivo (sin espacios). */
export function fechaArchivo(fecha: Date): string {
  return `${fecha.getDate()}-${MESES[fecha.getMonth()]}-${fecha.getFullYear()}`;
}

/** "13-al-14-julio" — rango compacto para nombres de archivo. */
export function rangoArchivo(inicio: Date | null | undefined, fin: Date | null | undefined): string {
  if (!inicio || !fin) return 'sinfechas';
  if (inicio.getMonth() === fin.getMonth() && inicio.getFullYear() === fin.getFullYear()) {
    return `${inicio.getDate()}-al-${fin.getDate()}-${MESES[inicio.getMonth()]}`;
  }
  return `${fechaArchivo(inicio)}-al-${fechaArchivo(fin)}`;
}
