/**
 * Parser de MRZ (Machine Readable Zone) de pasaporte, formato TD3 (2 líneas de
 * 44 caracteres). Extrae país, apellidos, nombres y número de documento.
 *
 * Formato TD3:
 *   Línea 1: P<PAÍS APELLIDOS<<NOMBRES<<<<<<<<<<<<<<<<<<<
 *   Línea 2: DOCNUM<CD PAÍSNAC AAMMDD C SEXO AAMMDD C ...
 *
 * El OCR real (imagen→texto) lo hace el componente con tesseract.js; esta
 * función solo interpreta el texto MRZ ya extraído (fácil de testear).
 */
export interface DatosMrz {
  pais?: string;
  apellidos?: string;
  nombres?: string;
  numeroDocumento?: string;
  nombreCompleto?: string;
}

/** Limpia el relleno '<' y espacios de un campo MRZ. */
function limpiar(s: string): string {
  return s.replace(/</g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Intenta parsear MRZ desde un texto que puede contener ruido de OCR.
 * Busca las dos líneas: la que empieza con 'P<' y la siguiente.
 */
export function parseMrz(textoOcr: string): DatosMrz | null {
  // Normaliza: mayúsculas, quita espacios internos que el OCR mete entre chars.
  const lineas = textoOcr
    .toUpperCase()
    .split('\n')
    .map((l) => l.replace(/\s/g, ''))
    .filter((l) => l.length >= 30);

  // Línea 1: documento de viaje tipo P (pasaporte).
  const linea1 = lineas.find((l) => /^P[<A-Z0-9]/.test(l));
  if (!linea1) return null;
  const idx1 = lineas.indexOf(linea1);
  const linea2 = lineas[idx1 + 1];

  const datos: DatosMrz = {};

  // --- Línea 1: P<PAIS APELLIDOS<<NOMBRES ---
  // Posiciones: [0]=P, [1]=< , [2..4]=país (3 letras), [5..]=nombres.
  const m1 = /^P.([A-Z<]{3})(.+)$/.exec(linea1);
  if (m1) {
    datos.pais = m1[1].replace(/</g, '');
    const nombresRaw = m1[2];
    // Separador entre apellidos y nombres: '<<'
    const partes = nombresRaw.split('<<');
    datos.apellidos = limpiar(partes[0] ?? '');
    datos.nombres = limpiar(partes[1] ?? '');
    datos.nombreCompleto = limpiar(`${datos.nombres} ${datos.apellidos}`);
  }

  // --- Línea 2: número de documento (primeros 9 caracteres hasta el check) ---
  if (linea2) {
    const numRaw = linea2.slice(0, 9).replace(/</g, '');
    if (numRaw) datos.numeroDocumento = numRaw;
  }

  // Si no logramos ni nombre ni documento, consideramos que falló.
  if (!datos.nombreCompleto && !datos.numeroDocumento) return null;
  return datos;
}
