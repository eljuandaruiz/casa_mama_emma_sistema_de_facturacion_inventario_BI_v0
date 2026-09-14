/**
 * Simulador de precio (calculadora, NO emite factura real al SRI — eso
 * requiere certificado digital e internet y se queda en el sistema de la PC).
 * Misma lógica de tarifas que el sistema principal, en versión resumida.
 */
import { aCentavos, aDolares } from './dinero';

export type ModoPrecio = 'HABITACION' | 'PERSONA' | 'CASA_COMPLETA' | 'AIRBNB';

export const TARIFAS_IVA: { codigo: string; tarifa: number; etiqueta: string }[] = [
  { codigo: '4', tarifa: 15, etiqueta: '15% (general)' },
  { codigo: '8', tarifa: 8, etiqueta: '8% (feriados turísticos)' },
  { codigo: '0', tarifa: 0, etiqueta: '0%' },
];

export interface HabitacionPrecio {
  numero: number;
  capacidad: number;
  precioHabitacion: number;
  precioPersona: number;
}

export interface ParametrosSimulacion {
  habitaciones: HabitacionPrecio[];
  modo: ModoPrecio;
  huespedes: number;
  noches: number;
  codigoIva: string;
  comisionAirbnbPct?: number; // solo modo AIRBNB
  netoAirbnbUsd?: number; // solo modo AIRBNB: lo que llega al anfitrión
}

export interface ResultadoSimulacion {
  detalle: { descripcion: string; valor: number }[];
  subtotal: number;
  tarifaIva: number;
  valorIva: number;
  total: number;
  airbnb?: { pagadoPorTurista: number; comision: number };
}

function baseDesdeTotalConIva(totalCent: number, tarifa: number): number {
  if (tarifa <= 0) return totalCent;
  return Math.round(totalCent / (1 + tarifa / 100));
}

export function simularPrecio(p: ParametrosSimulacion): ResultadoSimulacion {
  const tarifa = TARIFAS_IVA.find((t) => t.codigo === p.codigoIva)?.tarifa ?? 15;

  if (p.modo === 'AIRBNB') {
    const comisionPct = p.comisionAirbnbPct ?? 15.5;
    const netoCent = aCentavos(p.netoAirbnbUsd ?? 0);
    const brutoCent = Math.round(netoCent / (1 - comisionPct / 100));
    const baseCent = baseDesdeTotalConIva(netoCent, tarifa);
    const ivaCent = netoCent - baseCent;
    return {
      detalle: [{ descripcion: `Hospedaje (Airbnb, neto recibido) · ${p.huespedes} pax × ${p.noches} noche(s)`, valor: aDolares(baseCent) }],
      subtotal: aDolares(baseCent),
      tarifaIva: tarifa,
      valorIva: aDolares(ivaCent),
      total: aDolares(netoCent),
      airbnb: { pagadoPorTurista: aDolares(brutoCent), comision: aDolares(brutoCent - netoCent) },
    };
  }

  const detalle: ResultadoSimulacion['detalle'] = [];
  let subtotalCent = 0;

  if (p.modo === 'CASA_COMPLETA') {
    for (const h of p.habitaciones) subtotalCent += aCentavos(h.precioHabitacion) * p.noches;
    detalle.push({ descripcion: `Casa completa · ${p.noches} noche(s) · ${p.huespedes} huésped(es)`, valor: aDolares(subtotalCent) });
  } else if (p.modo === 'HABITACION') {
    for (const h of p.habitaciones) {
      const cent = aCentavos(h.precioHabitacion) * p.noches;
      subtotalCent += cent;
      detalle.push({ descripcion: `Habitación ${h.numero} · tarifa por habitación · ${p.noches} noche(s)`, valor: aDolares(cent) });
    }
  } else {
    let restantes = p.huespedes;
    p.habitaciones.forEach((h, idx) => {
      const esUltima = idx === p.habitaciones.length - 1;
      const asignados = esUltima ? restantes : Math.min(restantes, h.capacidad);
      restantes -= asignados;
      if (asignados <= 0) return;
      const cent = aCentavos(h.precioPersona) * asignados * p.noches;
      subtotalCent += cent;
      detalle.push({ descripcion: `Habitación ${h.numero} · ${asignados} persona(s) × ${p.noches} noche(s)`, valor: aDolares(cent) });
    });
  }

  const ivaCent = Math.round((subtotalCent * tarifa) / 100);
  return {
    detalle,
    subtotal: aDolares(subtotalCent),
    tarifaIva: tarifa,
    valorIva: aDolares(ivaCent),
    total: aDolares(subtotalCent + ivaCent),
  };
}
