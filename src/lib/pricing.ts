/**
 * LÓGICA DE PRECIOS — corazón del requisito crítico:
 *   A) "Precio por habitación": tarifa plana por noche, sin importar huéspedes
 *      (limitados a la capacidad de la habitación).
 *   B) "Precio por persona": tarifa por persona × nº de huéspedes × noches.
 *
 * Todo se calcula en centavos (ver money.ts) y se devuelve en USD 2 dec.
 */
import { aCentavos, aDolares } from '@/lib/money';
import { tarifaPorCodigo } from '@/lib/sri/catalogos';

export type ModoPrecio = 'HABITACION' | 'PERSONA' | 'CASA_COMPLETA' | 'AIRBNB';

/** Etiqueta legal para la línea de detalle de la casa completa. */
export const DESCRIPCION_CASA_COMPLETA = 'Alquiler Casa Completa Casa Mamá Emma';

/** Comisión que retiene Airbnb del precio de la plataforma (por defecto 15.5%). */
export const COMISION_AIRBNB_DEFECTO = 15.5;

export interface HabitacionPrecio {
  numero: number;
  capacidad: number;
  precioHabitacion: number; // USD / noche
  precioPersona: number; // USD / persona / noche
}

export interface ParametrosCalculo {
  habitaciones: HabitacionPrecio[]; // 1..n (permite facturar el espacio compartido 3-4 junto)
  modo: ModoPrecio;
  huespedes: number;
  noches: number;
  descuentoUsd?: number; // descuento total en USD (opcional)
  codigoIva: string; // "4" | "8" | "0"
  precioManualUsd?: number; // si el anfitrión pacta un precio distinto, prevalece
  // --- Modo AIRBNB (bidireccional) ---
  // Se puede partir de CUALQUIERA de estos tres datos; el resto se deriva:
  //   1. netoAirbnbUsd : lo que LLEGA al anfitrión (payout) → deriva el total.
  //   2. totalAirbnbUsd: lo que PAGA el turista en la plataforma → deriva el neto.
  //   3. precioAirbnbPersona: precio por persona/noche (modo antiguo, compat).
  netoAirbnbUsd?: number;
  totalAirbnbUsd?: number;
  precioAirbnbPersona?: number;
  // Comisión que retiene la plataforma (%). Si no se pasa, usa el default.
  comisionAirbnb?: number;
}

export interface ResultadoCalculo {
  capacidadTotal: number;
  excedeCapacidad: boolean;
  subtotal: number; // antes de descuento e IVA
  descuento: number;
  baseImponible: number; // subtotal - descuento
  tarifaIva: number; // 15 | 8 | 0
  valorIva: number;
  total: number;
  detallePorHabitacion: { numero: number; descripcion: string; valor: number }[];
  // Presente solo en modo AIRBNB: rastro del cálculo para mostrar y facturar.
  airbnb?: {
    precioPlataforma: number; // lo que ve/paga el turista en Airbnb
    comision: number; // lo que retiene Airbnb
    comisionPct: number;
    netoRecibido: number; // lo que llega al anfitrión (= total con IVA incluido)
  };
}

/**
 * Dado un monto que YA incluye IVA, devuelve la base imponible en centavos.
 * base = total / (1 + tarifa/100).
 */
function baseDesdeTotalConIva(totalCent: number, tarifa: number): number {
  if (tarifa <= 0) return totalCent;
  return Math.round(totalCent / (1 + tarifa / 100));
}

export function calcularPrecio(p: ParametrosCalculo): ResultadoCalculo {
  if (p.noches < 1) throw new Error('Las noches deben ser al menos 1');
  if (p.huespedes < 1) throw new Error('Debe haber al menos 1 huésped');
  if (p.habitaciones.length === 0) throw new Error('Seleccione al menos una habitación');

  const capacidadTotal = p.habitaciones.reduce((a, h) => a + h.capacidad, 0);
  const excedeCapacidad = p.huespedes > capacidadTotal;

  let subtotalCent = 0;
  const detallePorHabitacion: ResultadoCalculo['detallePorHabitacion'] = [];
  const { tarifa: tarifaGlobal } = tarifaPorCodigo(p.codigoIva);

  // ============ MODO AIRBNB (cálculo inverso: neto con IVA incluido) ============
  // El turista paga en Airbnb `precioAirbnbPersona` × huéspedes × noches.
  // Airbnb retiene su comisión; lo que LLEGA al anfitrión es el neto, y ese
  // neto YA incluye el IVA. Se factura sobre el neto: base + IVA = neto.
  if (p.modo === 'AIRBNB') {
    const comisionPct = p.comisionAirbnb ?? COMISION_AIRBNB_DEFECTO;
    if (comisionPct >= 100) throw new Error('La comisión no puede ser 100% o más');

    // Cálculo BIDIRECCIONAL: se parte del dato que el anfitrión tenga a mano.
    let brutoCent: number; // lo que paga el turista en Airbnb
    let netoCent: number; // lo que llega al anfitrión (payout, IVA incluido)
    if (p.netoAirbnbUsd !== undefined && p.netoAirbnbUsd > 0) {
      // Conozco el payout → derivo el total de plataforma: total = neto / (1 − c%)
      netoCent = aCentavos(p.netoAirbnbUsd);
      brutoCent = Math.round(netoCent / (1 - comisionPct / 100));
    } else if (p.totalAirbnbUsd !== undefined && p.totalAirbnbUsd > 0) {
      // Conozco el total que pagó el turista → derivo el neto
      brutoCent = aCentavos(p.totalAirbnbUsd);
      netoCent = brutoCent - Math.round((brutoCent * comisionPct) / 100);
    } else {
      // Compat: precio por persona/noche publicado en Airbnb
      const precioPP = p.precioAirbnbPersona ?? 0;
      if (precioPP <= 0) throw new Error('Ingresa el total de Airbnb o el neto que recibes');
      brutoCent = aCentavos(precioPP) * p.huespedes * p.noches;
      netoCent = brutoCent - Math.round((brutoCent * comisionPct) / 100);
    }
    const comisionCent = brutoCent - netoCent;

    // Descuento opcional sobre el neto recibido.
    const descAirbnbCent = aCentavos(p.descuentoUsd ?? 0);
    if (descAirbnbCent > netoCent) throw new Error('El descuento no puede superar el neto recibido');
    netoCent -= descAirbnbCent;

    const baseCentA = baseDesdeTotalConIva(netoCent, tarifaGlobal);
    const ivaCentA = netoCent - baseCentA;

    detallePorHabitacion.push({
      numero: p.habitaciones[0]?.numero ?? 0,
      descripcion: `Hospedaje (Airbnb, neto recibido) · ${p.huespedes} persona(s) × ${p.noches} noche(s)`,
      valor: aDolares(baseCentA), // el detalle muestra la BASE (sin IVA)
    });

    return {
      capacidadTotal,
      excedeCapacidad,
      subtotal: aDolares(baseCentA),
      descuento: aDolares(descAirbnbCent),
      baseImponible: aDolares(baseCentA),
      tarifaIva: tarifaGlobal,
      valorIva: aDolares(ivaCentA),
      total: aDolares(netoCent),
      detallePorHabitacion,
      airbnb: {
        precioPlataforma: aDolares(brutoCent),
        comision: aDolares(comisionCent),
        comisionPct,
        netoRecibido: aDolares(netoCent + descAirbnbCent), // neto antes del descuento
      },
    };
  }

  if (p.precioManualUsd !== undefined && p.precioManualUsd > 0) {
    // Precio pactado manualmente (prevalece sobre el cálculo automático)
    subtotalCent = aCentavos(p.precioManualUsd);
    detallePorHabitacion.push({
      numero: p.habitaciones[0].numero,
      descripcion: `Hospedaje (precio acordado) · ${p.noches} noche(s) · ${p.huespedes} huésped(es)`,
      valor: aDolares(subtotalCent),
    });
  } else if (p.modo === 'CASA_COMPLETA') {
    // C) Casa completa: una sola línea agrupada. Sin precio pactado, se
    // suma la tarifa plana de TODAS las habitaciones activas seleccionadas.
    let cent = 0;
    for (const h of p.habitaciones) cent += aCentavos(h.precioHabitacion) * p.noches;
    subtotalCent = cent;
    detallePorHabitacion.push({
      numero: 0, // 0 = comprobante de casa completa (no mapea a una habitación)
      descripcion: `${DESCRIPCION_CASA_COMPLETA} · ${p.noches} noche(s) · ${p.huespedes} huésped(es)`,
      valor: aDolares(cent),
    });
  } else if (p.modo === 'HABITACION') {
    // A) Tarifa plana por habitación por noche
    for (const h of p.habitaciones) {
      const cent = aCentavos(h.precioHabitacion) * p.noches;
      subtotalCent += cent;
      detallePorHabitacion.push({
        numero: h.numero,
        descripcion: `Hospedaje Habitación ${h.numero} · tarifa por habitación · ${p.noches} noche(s)`,
        valor: aDolares(cent),
      });
    }
  } else {
    // B) Por persona: huéspedes × tarifa por persona × noches.
    // Con varias habitaciones se reparte proporcionalmente a la capacidad
    // (el precio por persona puede variar entre habitaciones).
    let restantes = p.huespedes;
    p.habitaciones.forEach((h, idx) => {
      const esUltima = idx === p.habitaciones.length - 1;
      const asignados = esUltima ? restantes : Math.min(restantes, h.capacidad);
      restantes -= asignados;
      if (asignados <= 0) return;
      const cent = aCentavos(h.precioPersona) * asignados * p.noches;
      subtotalCent += cent;
      detallePorHabitacion.push({
        numero: h.numero,
        descripcion: `Hospedaje Habitación ${h.numero} · ${asignados} persona(s) × ${p.noches} noche(s)`,
        valor: aDolares(cent),
      });
    });
  }

  const descuentoCent = aCentavos(p.descuentoUsd ?? 0);
  if (descuentoCent > subtotalCent) throw new Error('El descuento no puede superar el subtotal');

  const baseCent = subtotalCent - descuentoCent;
  const ivaCent = Math.round((baseCent * tarifaGlobal) / 100);

  return {
    capacidadTotal,
    excedeCapacidad,
    subtotal: aDolares(subtotalCent),
    descuento: aDolares(descuentoCent),
    baseImponible: aDolares(baseCent),
    tarifaIva: tarifaGlobal,
    valorIva: aDolares(ivaCent),
    total: aDolares(baseCent + ivaCent),
    detallePorHabitacion,
  };
}
