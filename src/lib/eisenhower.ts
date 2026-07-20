/**
 * Matriz de Eisenhower para priorizar solicitudes de reparación/mejora.
 * Cruza urgencia × importancia en 4 cuadrantes con una acción sugerida.
 */
export interface Cuadrante {
  valor: string;
  etiqueta: string;
  accion: string; // qué hacer según la metodología
  color: string; // color de acento para la UI
}

export const CUADRANTES: Cuadrante[] = [
  { valor: 'URGENTE_IMPORTANTE', etiqueta: 'Urgente e importante', accion: 'Hacer ya', color: '#dc2626' },
  { valor: 'IMPORTANTE_NO_URGENTE', etiqueta: 'Importante, no urgente', accion: 'Agendar', color: '#0d9488' },
  { valor: 'URGENTE_NO_IMPORTANTE', etiqueta: 'Urgente, no importante', accion: 'Delegar', color: '#d97706' },
  { valor: 'NI_URGENTE_NI_IMPORTANTE', etiqueta: 'Ni urgente ni importante', accion: 'Descartar / luego', color: '#64748b' },
];

export function cuadranteDe(valor: string | null | undefined): Cuadrante {
  return CUADRANTES.find((c) => c.valor === valor) ?? CUADRANTES[1];
}
