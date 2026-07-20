/**
 * Lector del CSV de reservas que exporta Airbnb (menú Reservaciones →
 * Exportar). Tolerante a los dos formatos de encabezado (inglés/español) y a
 * fechas MM/DD/YYYY o YYYY-MM-DD. No usa dependencias externas.
 */

export interface ReservaCsv {
  codigoConfirmacion: string;
  huesped: string | null;
  adultos: number | null;
  ninos: number | null;
  checkIn: Date | null;
  checkOut: Date | null;
  noches: number | null;
  estado: string | null;
  ganancias: string | null; // texto tal cual ("$84.50") — informativo
  cancelada: boolean;
}

/** Parser CSV mínimo con soporte de comillas dobles y comas internas. */
export function parseCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let enComillas = false;
  // Normaliza saltos de línea y quita BOM.
  const s = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (enComillas) {
      if (c === '"') {
        if (s[i + 1] === '"') { campo += '"'; i++; } // comilla escapada
        else enComillas = false;
      } else campo += c;
    } else if (c === '"') {
      enComillas = true;
    } else if (c === ',') {
      fila.push(campo); campo = '';
    } else if (c === '\n') {
      fila.push(campo); campo = '';
      if (fila.some((x) => x.trim() !== '')) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((x) => x.trim() !== '')) filas.push(fila);
  return filas;
}

/** Busca el índice de la columna cuyo encabezado contenga alguno de los términos. */
function col(encabezados: string[], ...terminos: string[]): number {
  const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return encabezados.findIndex((h) => terminos.some((t) => norm(h).includes(norm(t))));
}

function parseFecha(v: string | undefined): Date | null {
  const t = (v ?? '').trim();
  if (!t) return null;
  // YYYY-MM-DD
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // MM/DD/YYYY (formato de exportación de Airbnb en inglés)
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

const num = (v: string | undefined): number | null => {
  const n = Number((v ?? '').trim());
  return Number.isFinite(n) ? n : null;
};

/** Convierte el CSV completo de Airbnb en reservas estructuradas. */
export function parseAirbnbCsv(texto: string): { reservas: ReservaCsv[]; errores: string[] } {
  const filas = parseCsv(texto);
  if (filas.length < 2) return { reservas: [], errores: ['El archivo no tiene filas de datos'] };

  const h = filas[0];
  const iCodigo = col(h, 'confirmation', 'codigo de confirmacion', 'código');
  const iEstado = col(h, 'status', 'estado');
  const iHuesped = col(h, 'guest name', 'nombre del huesped', 'guest');
  const iAdultos = col(h, 'adult', 'adulto');
  const iNinos = col(h, 'child', 'nino', 'niño');
  const iInicio = col(h, 'start date', 'fecha de inicio', 'check-in', 'checkin');
  const iFin = col(h, 'end date', 'fecha de fin', 'finalizacion', 'check-out', 'checkout');
  const iNoches = col(h, 'night', 'noche');
  const iGanancias = col(h, 'earnings', 'ganancia');

  const errores: string[] = [];
  if (iCodigo < 0) errores.push('No se encontró la columna de código de confirmación');
  if (iInicio < 0 || iFin < 0) errores.push('No se encontraron las columnas de fechas');
  if (errores.length > 0) return { reservas: [], errores };

  const reservas: ReservaCsv[] = [];
  for (let f = 1; f < filas.length; f++) {
    const r = filas[f];
    const codigo = (r[iCodigo] ?? '').trim();
    if (!codigo) continue;
    const estado = iEstado >= 0 ? (r[iEstado] ?? '').trim() : null;
    reservas.push({
      codigoConfirmacion: codigo,
      huesped: iHuesped >= 0 ? (r[iHuesped] ?? '').trim() || null : null,
      adultos: iAdultos >= 0 ? num(r[iAdultos]) : null,
      ninos: iNinos >= 0 ? num(r[iNinos]) : null,
      checkIn: parseFecha(r[iInicio]),
      checkOut: parseFecha(r[iFin]),
      noches: iNoches >= 0 ? num(r[iNoches]) : null,
      estado,
      ganancias: iGanancias >= 0 ? (r[iGanancias] ?? '').trim() || null : null,
      cancelada: /cancel/i.test(estado ?? ''),
    });
  }
  return { reservas, errores };
}
