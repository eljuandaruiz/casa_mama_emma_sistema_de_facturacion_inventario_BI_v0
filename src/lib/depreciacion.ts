/**
 * Depreciación de activos por el método de LÍNEA RECTA, con los porcentajes
 * máximos anuales del Reglamento a la LORTI de Ecuador (Art. 28):
 *   - Inmuebles (excepto terrenos): 5%  -> 20 años
 *   - Muebles, enseres, maquinaria: 10% -> 10 años
 *   - Equipo de cómputo y software: 33% -> ~3 años
 *   - Vehículos: 20% -> 5 años
 *
 * Línea recta: depreciación anual = costo / años de vida útil.
 */
export interface CategoriaActivo {
  valor: string;
  etiqueta: string;
  porcentajeAnual: number; // % de depreciación anual (reglamento)
  aniosVidaUtil: number;
  esActivo: boolean; // true = se deprecia; false = consumible (gasto directo)
}

export const CATEGORIAS_COMPRA: CategoriaActivo[] = [
  { valor: 'MUEBLES', etiqueta: 'Muebles y enseres', porcentajeAnual: 10, aniosVidaUtil: 10, esActivo: true },
  { valor: 'ELECTRODOMESTICOS', etiqueta: 'Electrodomésticos', porcentajeAnual: 10, aniosVidaUtil: 10, esActivo: true },
  { valor: 'EQUIPO_COMPUTO', etiqueta: 'Equipo de cómputo', porcentajeAnual: 33, aniosVidaUtil: 3, esActivo: true },
  { valor: 'HERRAMIENTAS', etiqueta: 'Herramientas', porcentajeAnual: 10, aniosVidaUtil: 10, esActivo: true },
  { valor: 'INMUEBLE', etiqueta: 'Mejora de inmueble', porcentajeAnual: 5, aniosVidaUtil: 20, esActivo: true },
  { valor: 'VEHICULO', etiqueta: 'Vehículo', porcentajeAnual: 20, aniosVidaUtil: 5, esActivo: true },
  // Consumibles: no se deprecian; son gasto del período.
  { valor: 'INSUMOS', etiqueta: 'Insumos / consumibles', porcentajeAnual: 0, aniosVidaUtil: 0, esActivo: false },
  { valor: 'LENCERIA', etiqueta: 'Lencería / amenidades', porcentajeAnual: 0, aniosVidaUtil: 0, esActivo: false },
  { valor: 'OTROS', etiqueta: 'Otros', porcentajeAnual: 0, aniosVidaUtil: 0, esActivo: false },
];

export function categoriaCompra(valor: string): CategoriaActivo {
  return CATEGORIAS_COMPRA.find((c) => c.valor === valor) ?? CATEGORIAS_COMPRA[CATEGORIAS_COMPRA.length - 1];
}

export interface CalculoDepreciacion {
  esActivo: boolean;
  depreciacionAnual: number;
  depreciacionAcumulada: number;
  valorEnLibros: number; // costo - depreciación acumulada (mínimo 0)
  aniosTranscurridos: number;
  totalmenteDepreciado: boolean;
}

/**
 * Calcula la depreciación de una compra a una fecha dada (por defecto hoy).
 * Para consumibles devuelve valores en cero (esActivo=false).
 */
export function calcularDepreciacion(
  costo: number,
  categoria: string,
  fechaCompra: Date,
  hasta: Date = new Date(),
): CalculoDepreciacion {
  const cat = categoriaCompra(categoria);
  if (!cat.esActivo || cat.aniosVidaUtil <= 0) {
    return {
      esActivo: false,
      depreciacionAnual: 0,
      depreciacionAcumulada: 0,
      valorEnLibros: costo,
      aniosTranscurridos: 0,
      totalmenteDepreciado: false,
    };
  }
  const ms = hasta.getTime() - fechaCompra.getTime();
  const aniosTranscurridos = Math.max(0, ms / (365.25 * 24 * 3600 * 1000));
  const depreciacionAnual = costo / cat.aniosVidaUtil;
  const acumuladaBruta = depreciacionAnual * aniosTranscurridos;
  const depreciacionAcumulada = Math.min(costo, Math.round(acumuladaBruta * 100) / 100);
  const valorEnLibros = Math.round((costo - depreciacionAcumulada) * 100) / 100;
  return {
    esActivo: true,
    depreciacionAnual: Math.round(depreciacionAnual * 100) / 100,
    depreciacionAcumulada,
    valorEnLibros,
    aniosTranscurridos: Math.round(aniosTranscurridos * 100) / 100,
    totalmenteDepreciado: depreciacionAcumulada >= costo,
  };
}
