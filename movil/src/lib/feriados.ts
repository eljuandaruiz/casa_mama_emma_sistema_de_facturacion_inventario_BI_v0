/**
 * Feriados nacionales de Ecuador (Ley Orgánica de Feriados, 2016) y temporadas
 * turísticas de Baños de Agua Santa. Trabaja con fechas "YYYY-MM-DD" (día civil).
 */
export type NivelTemporada = 'alta' | 'media' | 'baja';

export interface Feriado {
  /** Día efectivo de descanso (ya trasladado si aplica). */
  fecha: string;
  nombre: string;
  /** Fecha original según la ley. */
  fechaLegal: string;
}

export interface Temporada {
  nivel: NivelTemporada;
  etiqueta: string;
}

const DIA_MS = 86_400_000;
const utc = (anio: number, mes: number, dia: number) => new Date(Date.UTC(anio, mes - 1, dia));
const aClave = (d: Date) => d.toISOString().slice(0, 10);
const deClave = (clave: string) => new Date(`${clave}T00:00:00Z`);
const sumar = (d: Date, dias: number) => new Date(d.getTime() + dias * DIA_MS);
const diaSemana = (d: Date) => d.getUTCDay(); // 0 domingo … 6 sábado

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
export function pascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(anio, mes, dia);
}

// Art. 3: martes → lunes anterior; miércoles/jueves → viernes; sábado → viernes; domingo → lunes.
// 1 de enero y 25 de diciembre no se trasladan cuando caen entre martes y jueves.
function trasladar(fecha: Date, finDeAnio: boolean): Date {
  const ds = diaSemana(fecha);
  if (ds === 6) return sumar(fecha, -1);
  if (ds === 0) return sumar(fecha, 1);
  if (finDeAnio) return fecha;
  if (ds === 2) return sumar(fecha, -1);
  if (ds === 3) return sumar(fecha, 2);
  if (ds === 4) return sumar(fecha, 1);
  return fecha;
}

/** Correcciones por decreto (fecha legal → fecha observada), si el Ejecutivo cambia un traslado. */
const AJUSTES_OFICIALES: Record<string, string> = {};

export function feriadosDelAnio(anio: number): Feriado[] {
  const p = pascua(anio);
  const lista: Feriado[] = [
    { fechaLegal: aClave(sumar(p, -48)), fecha: aClave(sumar(p, -48)), nombre: 'Carnaval' },
    { fechaLegal: aClave(sumar(p, -47)), fecha: aClave(sumar(p, -47)), nombre: 'Carnaval' },
    { fechaLegal: aClave(sumar(p, -2)), fecha: aClave(sumar(p, -2)), nombre: 'Viernes Santo' },
  ];
  const fijos: Array<[number, number, string]> = [
    [1, 1, 'Año Nuevo'],
    [5, 1, 'Día del Trabajo'],
    [5, 24, 'Batalla de Pichincha'],
    [8, 10, 'Primer Grito de Independencia'],
    [10, 9, 'Independencia de Guayaquil'],
    [12, 25, 'Navidad'],
  ];
  for (const [mes, dia, nombre] of fijos) {
    const legal = utc(anio, mes, dia);
    const observada = trasladar(legal, mes === 1 || mes === 12);
    lista.push({ fechaLegal: aClave(legal), fecha: aClave(observada), nombre });
  }
  // 2 y 3 de noviembre se trasladan en bloque para no partir el puente.
  const difuntos = utc(anio, 11, 2);
  const cuenca = utc(anio, 11, 3);
  const ds2 = diaSemana(difuntos);
  let obs2 = trasladar(difuntos, false);
  let obs3 = trasladar(cuenca, false);
  if (ds2 === 2) [obs2, obs3] = [sumar(difuntos, -1), difuntos];
  else if (ds2 === 3) [obs2, obs3] = [cuenca, sumar(cuenca, 1)];
  else if (aClave(obs2) === aClave(obs3)) obs3 = cuenca;
  lista.push({ fechaLegal: aClave(difuntos), fecha: aClave(obs2), nombre: 'Día de los Difuntos' });
  lista.push({ fechaLegal: aClave(cuenca), fecha: aClave(obs3), nombre: 'Independencia de Cuenca' });

  for (const f of lista) f.fecha = AJUSTES_OFICIALES[f.fechaLegal] ?? f.fecha;
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

const cache = new Map<number, Map<string, string>>();
function mapaFeriados(anio: number): Map<string, string> {
  let m = cache.get(anio);
  if (!m) {
    m = new Map(feriadosDelAnio(anio).map((f) => [f.fecha, f.nombre]));
    cache.set(anio, m);
  }
  return m;
}

/** Nombre del feriado si el día (YYYY-MM-DD) es feriado observado; si no, null. */
export function feriadoDe(clave: string): string | null {
  return mapaFeriados(Number(clave.slice(0, 4))).get(clave) ?? null;
}

export const esFeriado = (clave: string): boolean => feriadoDe(clave) !== null;

/**
 * Temporada turística de una NOCHE (día civil en que empieza la noche).
 * Alta: feriados y sus puentes, Carnaval, Semana Santa y fin de año.
 * Media: fines de semana y vacaciones escolares (Sierra/Amazonía jul-ago, Costa mar-abr).
 * Baja: el resto.
 */
export function temporadaDe(clave: string): Temporada {
  const d = deClave(clave);
  const anio = d.getUTCFullYear();
  const mes = d.getUTCMonth() + 1;
  const dia = d.getUTCDate();
  const ds = diaSemana(d);

  const propio = feriadoDe(clave);
  if (propio) return { nivel: 'alta', etiqueta: propio };
  const p = pascua(anio);
  const desdePascua = Math.round((d.getTime() - p.getTime()) / DIA_MS);
  if (desdePascua >= -50 && desdePascua <= -47) return { nivel: 'alta', etiqueta: 'Carnaval' };
  if (desdePascua >= -3 && desdePascua <= 0) return { nivel: 'alta', etiqueta: 'Semana Santa' };
  if ((mes === 12 && dia >= 22) || (mes === 1 && dia <= 3)) return { nivel: 'alta', etiqueta: 'Fin de año' };
  // Fin de semana pegado a un feriado = puente.
  if (ds === 6 || ds === 0) {
    const vecinos = ds === 6 ? [-1, 2] : [-2, 1];
    for (const v of vecinos) {
      const f = feriadoDe(aClave(sumar(d, v)));
      if (f) return { nivel: 'alta', etiqueta: `Puente ${f}` };
    }
  }
  if (ds === 5 || ds === 6) return { nivel: 'media', etiqueta: 'Fin de semana' };
  if (mes === 7 || mes === 8) return { nivel: 'media', etiqueta: 'Vacaciones Sierra y Amazonía' };
  if (mes === 3 || mes === 4) return { nivel: 'media', etiqueta: 'Vacaciones Costa' };
  return { nivel: 'baja', etiqueta: 'Entre semana' };
}
