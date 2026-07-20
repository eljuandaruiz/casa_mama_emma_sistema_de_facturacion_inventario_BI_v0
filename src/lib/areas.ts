/**
 * Áreas físicas de la propiedad — catálogo compartido por Mantenimiento y
 * Solicitudes de reparación, para ubicar espacialmente cada gasto/reparación
 * y poder analizar consumo por área.
 *
 * Nota: la Habitación 1 NO se alquila (uso interno/bodega), pero SÍ existe
 * como área para registrar mantenimiento y almacenamiento.
 */
export interface Area {
  valor: string;
  etiqueta: string;
}

export const AREAS: Area[] = [
  { valor: 'HAB_1', etiqueta: 'Habitación 1 (bodega / uso interno)' },
  { valor: 'HAB_2', etiqueta: 'Habitación 2' },
  { valor: 'HAB_3', etiqueta: 'Habitación 3' },
  { valor: 'HAB_4', etiqueta: 'Habitación 4' },
  { valor: 'HAB_5', etiqueta: 'Habitación 5' },
  { valor: 'HAB_6', etiqueta: 'Habitación 6' },
  { valor: 'HAB_7', etiqueta: 'Habitación 7' },
  { valor: 'SALA', etiqueta: 'Sala / área común' },
  { valor: 'EXTERIOR', etiqueta: 'Exterior' },
  { valor: 'GENERAL', etiqueta: 'General (toda la propiedad)' },
];

export function etiquetaArea(valor: string | null | undefined): string {
  if (!valor) return 'Sin área';
  return AREAS.find((a) => a.valor === valor)?.etiqueta ?? valor;
}
