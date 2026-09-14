/**
 * Estado de navegación PERSISTENTE. Android puede reiniciar la pantalla de la
 * app (al elegir una foto, por falta de memoria o al girar el teléfono); sin
 * esto el usuario volvía siempre a "Hoy" perdiendo dónde estaba.
 */
export type Pestana = 'hoy' | 'calendario' | 'dinero' | 'trabajos' | 'mas';

export interface EstadoNavegacion {
  pestana: Pestana;
  sub: string | null;
}

const CLAVE = 'cme_navegacion';
const PESTANAS_VALIDAS: Pestana[] = ['hoy', 'calendario', 'dinero', 'trabajos', 'mas'];

export function leerNavegacion(): EstadoNavegacion {
  try {
    const guardado = JSON.parse(sessionStorage.getItem(CLAVE) ?? 'null') as EstadoNavegacion | null;
    if (guardado && PESTANAS_VALIDAS.includes(guardado.pestana)) {
      return { pestana: guardado.pestana, sub: guardado.sub ?? null };
    }
  } catch {
    // sin almacenamiento: se arranca en Hoy
  }
  return { pestana: 'hoy', sub: null };
}

export function guardarNavegacion(estado: EstadoNavegacion) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    // sin almacenamiento: no pasa nada, solo no se recuerda
  }
}

/** Borrador de un formulario (para no perder lo escrito si Android reinicia la pantalla). */
export function leerBorrador<T>(clave: string): T | null {
  try {
    return JSON.parse(sessionStorage.getItem(`cme_borrador_${clave}`) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

export function guardarBorrador(clave: string, valor: unknown) {
  try {
    sessionStorage.setItem(`cme_borrador_${clave}`, JSON.stringify(valor));
  } catch {
    // el borrador es una comodidad: si no cabe, se sigue sin él
  }
}

export function borrarBorrador(clave: string) {
  try {
    sessionStorage.removeItem(`cme_borrador_${clave}`);
  } catch {
    // ignorar
  }
}
