/**
 * Nacionalidades MULTI-IDIOMA para formularios (facturación y portal).
 *
 * Diseño i18n escalable: cada nacionalidad tiene un CÓDIGO estable (ISO-3166
 * del país) y sus nombres por idioma. En la BD se guarda el nombre en el
 * idioma activo (texto legible para el SRI/CRM), pero la lista SIEMPRE se
 * presenta ORDENADA ALFABÉTICAMENTE según el idioma de la página — al añadir
 * otro idioma solo se agrega la columna de nombres y el sort lo resuelve
 * `localeCompare` con el locale correspondiente.
 */

export type Idioma = 'es' | 'en';

interface Nacionalidad {
  codigo: string; // ISO-3166 alpha-2 del país
  es: string;
  en: string;
}

const LISTA: Nacionalidad[] = [
  { codigo: 'DE', es: 'Alemana', en: 'German' },
  { codigo: 'AR', es: 'Argentina', en: 'Argentine' },
  { codigo: 'AU', es: 'Australiana', en: 'Australian' },
  { codigo: 'AT', es: 'Austriaca', en: 'Austrian' },
  { codigo: 'BE', es: 'Belga', en: 'Belgian' },
  { codigo: 'BO', es: 'Boliviana', en: 'Bolivian' },
  { codigo: 'BR', es: 'Brasileña', en: 'Brazilian' },
  { codigo: 'GB', es: 'Británica', en: 'British' },
  { codigo: 'CA', es: 'Canadiense', en: 'Canadian' },
  { codigo: 'CZ', es: 'Checa', en: 'Czech' },
  { codigo: 'CL', es: 'Chilena', en: 'Chilean' },
  { codigo: 'CN', es: 'China', en: 'Chinese' },
  { codigo: 'CO', es: 'Colombiana', en: 'Colombian' },
  { codigo: 'KR', es: 'Coreana', en: 'Korean' },
  { codigo: 'CR', es: 'Costarricense', en: 'Costa Rican' },
  { codigo: 'CU', es: 'Cubana', en: 'Cuban' },
  { codigo: 'DK', es: 'Danesa', en: 'Danish' },
  { codigo: 'DO', es: 'Dominicana', en: 'Dominican' },
  { codigo: 'EC', es: 'Ecuatoriana', en: 'Ecuadorian' },
  { codigo: 'ES', es: 'Española', en: 'Spanish' },
  { codigo: 'US', es: 'Estadounidense', en: 'American' },
  { codigo: 'FR', es: 'Francesa', en: 'French' },
  { codigo: 'GR', es: 'Griega', en: 'Greek' },
  { codigo: 'GT', es: 'Guatemalteca', en: 'Guatemalan' },
  { codigo: 'NL', es: 'Holandesa', en: 'Dutch' },
  { codigo: 'HN', es: 'Hondureña', en: 'Honduran' },
  { codigo: 'IN', es: 'India', en: 'Indian' },
  { codigo: 'IE', es: 'Irlandesa', en: 'Irish' },
  { codigo: 'IL', es: 'Israelí', en: 'Israeli' },
  { codigo: 'IT', es: 'Italiana', en: 'Italian' },
  { codigo: 'JP', es: 'Japonesa', en: 'Japanese' },
  { codigo: 'MX', es: 'Mexicana', en: 'Mexican' },
  { codigo: 'NI', es: 'Nicaragüense', en: 'Nicaraguan' },
  { codigo: 'NO', es: 'Noruega', en: 'Norwegian' },
  { codigo: 'NZ', es: 'Neozelandesa', en: 'New Zealander' },
  { codigo: 'PA', es: 'Panameña', en: 'Panamanian' },
  { codigo: 'PY', es: 'Paraguaya', en: 'Paraguayan' },
  { codigo: 'PE', es: 'Peruana', en: 'Peruvian' },
  { codigo: 'PL', es: 'Polaca', en: 'Polish' },
  { codigo: 'PT', es: 'Portuguesa', en: 'Portuguese' },
  { codigo: 'RU', es: 'Rusa', en: 'Russian' },
  { codigo: 'SV', es: 'Salvadoreña', en: 'Salvadoran' },
  { codigo: 'ZA', es: 'Sudafricana', en: 'South African' },
  { codigo: 'SE', es: 'Sueca', en: 'Swedish' },
  { codigo: 'CH', es: 'Suiza', en: 'Swiss' },
  { codigo: 'TR', es: 'Turca', en: 'Turkish' },
  { codigo: 'UY', es: 'Uruguaya', en: 'Uruguayan' },
  { codigo: 'VE', es: 'Venezolana', en: 'Venezuelan' },
];

const LOCALE: Record<Idioma, string> = { es: 'es', en: 'en' };
const OTRA: Record<Idioma, string> = { es: 'Otra', en: 'Other' };

/**
 * Nacionalidades en el idioma pedido, SIEMPRE en orden alfabético según ese
 * idioma ("Otra"/"Other" va al final). Por defecto español.
 */
export function nacionalidades(idioma: Idioma = 'es'): string[] {
  const nombres = LISTA.map((n) => n[idioma]);
  nombres.sort((a, b) => a.localeCompare(b, LOCALE[idioma], { sensitivity: 'base' }));
  return [...nombres, OTRA[idioma]];
}

/** Compat: lista en español (mismo nombre exportado que antes), ya ordenada. */
export const NACIONALIDADES: string[] = nacionalidades('es');

/** Filtra nacionalidades por texto (sin acentos, case-insensitive). */
export function filtrarNacionalidades(q: string, limite = 8, idioma: Idioma = 'es'): string[] {
  const lista = nacionalidades(idioma);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(q.trim());
  if (!t) return lista.slice(0, limite);
  return lista.filter((n) => norm(n).includes(t)).slice(0, limite);
}
