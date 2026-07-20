/**
 * Catálogos demográficos del módulo BI/CRM (oculto).
 * Valores guardados como texto en PerfilHuesped; estas listas dan las
 * etiquetas legibles y el orden para formularios y gráficos.
 */

export interface Opcion {
  valor: string;
  etiqueta: string;
}

export const GENEROS: Opcion[] = [
  { valor: 'MASCULINO', etiqueta: 'Masculino' },
  { valor: 'FEMENINO', etiqueta: 'Femenino' },
  { valor: 'OTRO', etiqueta: 'Otro' },
  { valor: 'PREFIERE_NO_DECIR', etiqueta: 'Prefiere no decir' },
];

export const ESTADOS_RELACION: Opcion[] = [
  { valor: 'SOLTERO', etiqueta: 'Soltero/a' },
  { valor: 'PAREJA', etiqueta: 'Pareja' },
  { valor: 'FAMILIA', etiqueta: 'Familia' },
  { valor: 'GRUPO_AMIGOS', etiqueta: 'Grupo de amigos' },
];

export const SEGMENTOS_VIAJERO: Opcion[] = [
  { valor: 'NOMADA_DIGITAL', etiqueta: 'Nómada digital' },
  { valor: 'TELETRABAJO_CORPORATIVO', etiqueta: 'Trabajo / corporativo' },
  { valor: 'OCIO', etiqueta: 'Ocio / turismo' },
  { valor: 'JUBILADO', etiqueta: 'Jubilado/a' },
  { valor: 'ADULTO_MAYOR', etiqueta: 'Adulto mayor' },
  { valor: 'VIAJERO_ECUATORIANO', etiqueta: 'Viajero ecuatoriano' },
  { valor: 'OCASIONAL', etiqueta: 'Viajero ocasional' },
];

/** Rangos etarios para agrupar la edad en el dashboard. */
export const RANGOS_EDAD: { etiqueta: string; min: number; max: number }[] = [
  { etiqueta: '18-25', min: 18, max: 25 },
  { etiqueta: '26-35', min: 26, max: 35 },
  { etiqueta: '36-45', min: 36, max: 45 },
  { etiqueta: '46-60', min: 46, max: 60 },
  { etiqueta: '60+', min: 61, max: 200 },
];

export function rangoEdad(edad: number | null | undefined): string {
  if (edad == null) return 'Sin dato';
  const r = RANGOS_EDAD.find((x) => edad >= x.min && edad <= x.max);
  return r?.etiqueta ?? 'Sin dato';
}

/** Convierte un código a su etiqueta legible (o el propio código si no está). */
export function etiquetaDe(lista: Opcion[], valor: string | null | undefined): string {
  if (!valor) return 'Sin dato';
  return lista.find((o) => o.valor === valor)?.etiqueta ?? valor;
}
