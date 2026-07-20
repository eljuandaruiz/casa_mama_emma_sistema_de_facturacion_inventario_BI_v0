/**
 * Parser iCal (RFC 5545) mínimo, sin dependencias. Solo lo necesario para
 * las reservas de Airbnb: extrae los VEVENT con UID, DTSTART, DTEND y SUMMARY
 * (y DESCRIPTION, de donde a veces se puede inferir el nº de huéspedes).
 */

export interface EventoIcal {
  uid: string;
  resumen?: string;
  descripcion?: string;
  inicio: Date;
  fin: Date;
}

/** Deshace el "folding": líneas que continúan empiezan con espacio o tab. */
function desdoblar(texto: string): string[] {
  const crudas = texto.replace(/\r\n/g, '\n').split('\n');
  const salida: string[] = [];
  for (const linea of crudas) {
    if ((linea.startsWith(' ') || linea.startsWith('\t')) && salida.length > 0) {
      salida[salida.length - 1] += linea.slice(1);
    } else {
      salida.push(linea);
    }
  }
  return salida;
}

/** Convierte un valor DATE (20260715) o DATE-TIME (20260715T130000Z) a Date. */
function parseFecha(valor: string): Date {
  const v = valor.trim();
  const soloFecha = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (soloFecha) {
    const [, y, m, d] = soloFecha;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const conHora = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (conHora) {
    const [, y, m, d, hh, mm, ss, z] = conHora;
    if (z) return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss));
    return new Date(+y, +m - 1, +d, +hh, +mm, +ss);
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? new Date(NaN) : new Date(t);
}

/** Separa "DTSTART;VALUE=DATE:20260715" en clave, params y valor. */
function partirLinea(linea: string): { clave: string; valor: string } | null {
  const idx = linea.indexOf(':');
  if (idx === -1) return null;
  const izquierda = linea.slice(0, idx);
  const valor = linea.slice(idx + 1);
  const clave = izquierda.split(';')[0].toUpperCase();
  return { clave, valor };
}

export function parseIcal(texto: string): EventoIcal[] {
  const lineas = desdoblar(texto);
  const eventos: EventoIcal[] = [];
  let actual: Partial<EventoIcal> | null = null;

  for (const linea of lineas) {
    if (linea === 'BEGIN:VEVENT') {
      actual = {};
      continue;
    }
    if (linea === 'END:VEVENT') {
      if (actual?.uid && actual.inicio && actual.fin && !Number.isNaN(actual.inicio.getTime())) {
        eventos.push(actual as EventoIcal);
      }
      actual = null;
      continue;
    }
    if (!actual) continue;

    const p = partirLinea(linea);
    if (!p) continue;
    switch (p.clave) {
      case 'UID':
        actual.uid = p.valor.trim();
        break;
      case 'SUMMARY':
        actual.resumen = p.valor.trim();
        break;
      case 'DESCRIPTION':
        actual.descripcion = p.valor.replace(/\\n/g, '\n').replace(/\\,/g, ',').trim();
        break;
      case 'DTSTART':
        actual.inicio = parseFecha(p.valor);
        break;
      case 'DTEND':
        actual.fin = parseFecha(p.valor);
        break;
    }
  }
  return eventos;
}

/**
 * Intenta extraer el nº de huéspedes de la descripción de Airbnb, que suele
 * incluir líneas tipo "Guests: 3" o "2 adults". Devuelve undefined si no hay.
 */
export function inferirHuespedes(descripcion?: string): number | undefined {
  if (!descripcion) return undefined;
  const m =
    /(?:guests?|hu[eé]spedes?|pax)\s*[:=]?\s*(\d{1,2})/i.exec(descripcion) ??
    /(\d{1,2})\s*(?:adults?|adultos?|guests?|hu[eé]spedes?)/i.exec(descripcion);
  return m ? Number(m[1]) : undefined;
}
