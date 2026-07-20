/**
 * Las 15 categorías operativas del hospedaje — fuente única usada por
 * inventario, gastos y mantenimiento. Cada una lleva un icono (nombre de
 * Lucide, para la UI visual) y si corresponde a un COSTO FIJO (para el
 * prorrateo mensual).
 */
export interface CategoriaOperativa {
  valor: string;
  etiqueta: string;
  icono: string; // nombre de icono de Lucide (ver components/Icono.tsx)
  esFijo?: boolean; // true = costo fijo mensual (agua, luz, internet)
}

export const CATEGORIAS_OPERATIVAS: CategoriaOperativa[] = [
  { valor: 'AMENIDADES', etiqueta: 'Amenidades y aseo (champú, jabón)', icono: 'sparkles' },
  { valor: 'ROPA_CAMA', etiqueta: 'Lencería (sábanas, cobijas, toallas)', icono: 'bed' },
  { valor: 'LIMPIEZA', etiqueta: 'Productos de limpieza (químicos, escobas)', icono: 'spray-can' },
  { valor: 'PLOMERIA_BANO', etiqueta: 'Plomería y baño (inodoros, tuberías)', icono: 'wrench' },
  { valor: 'DUCHAS_ELECTRICAS', etiqueta: 'Duchas eléctricas', icono: 'shower-head' },
  { valor: 'GAS_AGUA_CALIENTE', etiqueta: 'Calefones y tanques de gas', icono: 'flame' },
  { valor: 'ELECTRODOMESTICOS', etiqueta: 'Electrodomésticos (TVs, microondas)', icono: 'tv' },
  { valor: 'MUEBLES_DECOR', etiqueta: 'Muebles y decoración', icono: 'sofa' },
  { valor: 'ILUMINACION_CABLEADO', etiqueta: 'Iluminación y cableado', icono: 'lightbulb' },
  { valor: 'COCINA_UTENSILIOS', etiqueta: 'Menaje y utensilios de cocina', icono: 'utensils' },
  { valor: 'PINTURA_ESTRUCTURA', etiqueta: 'Pintura y materiales (cemento)', icono: 'paint-roller' },
  { valor: 'MANO_OBRA', etiqueta: 'Mano de obra (albañilería, plomería)', icono: 'hard-hat' },
  { valor: 'FIJOS_UTILIDADES', etiqueta: 'Servicios fijos (agua, luz, internet)', icono: 'plug', esFijo: true },
  { valor: 'COMISIONES', etiqueta: 'Comisiones de plataforma y banco', icono: 'credit-card' },
  { valor: 'VARIOS', etiqueta: 'Varios / imprevistos', icono: 'circle-help' },
];

export function categoriaOperativa(valor: string): CategoriaOperativa {
  return (
    CATEGORIAS_OPERATIVAS.find((c) => c.valor === valor) ??
    CATEGORIAS_OPERATIVAS[CATEGORIAS_OPERATIVAS.length - 1]
  );
}
