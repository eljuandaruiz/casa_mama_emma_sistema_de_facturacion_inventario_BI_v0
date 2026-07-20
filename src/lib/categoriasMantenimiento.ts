/**
 * Categorías de mantenimiento con CÓDIGO DE COLOR (requisito del negocio para
 * identificación visual rápida en la lista y en el PDF).
 *
 *   Agua / Plomería    → Azul
 *   Agua caliente      → Naranja
 *   Eléctrico          → Amarillo
 *   Drenaje / Desagüe  → Café
 *   General / Otros    → Blanco / por defecto
 */
export interface CategoriaMantenimiento {
  valor: string;
  etiqueta: string;
  /** Color de acento (borde/etiqueta) en hex, para UI y PDF. */
  color: string;
  /** Fondo tenue para la tarjeta/tag en la UI. */
  colorFondo: string;
}

export const CATEGORIAS_MANTENIMIENTO: CategoriaMantenimiento[] = [
  { valor: 'AGUA_PLOMERIA', etiqueta: 'Agua / Plomería', color: '#2563eb', colorFondo: '#eff6ff' },
  { valor: 'AGUA_CALIENTE', etiqueta: 'Agua caliente', color: '#ea580c', colorFondo: '#fff7ed' },
  { valor: 'ELECTRICO', etiqueta: 'Eléctrico', color: '#ca8a04', colorFondo: '#fefce8' },
  { valor: 'DRENAJE', etiqueta: 'Drenaje / Desagüe', color: '#78350f', colorFondo: '#f5f0eb' },
  { valor: 'GENERAL', etiqueta: 'General', color: '#64748b', colorFondo: '#ffffff' },
];

export function categoriaMantenimiento(valor: string | null | undefined): CategoriaMantenimiento {
  return (
    CATEGORIAS_MANTENIMIENTO.find((c) => c.valor === valor) ??
    CATEGORIAS_MANTENIMIENTO[CATEGORIAS_MANTENIMIENTO.length - 1] // GENERAL por defecto
  );
}
