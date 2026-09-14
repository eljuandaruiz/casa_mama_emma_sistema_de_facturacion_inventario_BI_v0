import type { Habitacion, Reserva } from './db';

/** Bloque seleccionable: una habitación, o el espacio fusionado 3+4 (como en el PC). */
export interface Bloque {
  clave: string;
  etiqueta: string;
  numeros: number[];
  capacidad: number;
  precioHabitacion: number;
  descripcion: string;
}

const ESPACIO_UNICO = [3, 4];

export function bloquesDe(habitaciones: Habitacion[]): Bloque[] {
  const resultado: Bloque[] = [];
  const fusion = habitaciones.filter((h) => ESPACIO_UNICO.includes(h.numero));
  let fusionAgregada = false;
  for (const h of habitaciones) {
    if (ESPACIO_UNICO.includes(h.numero)) {
      if (fusionAgregada || fusion.length < 2) {
        if (fusion.length < 2) resultado.push(bloqueSimple(h));
        continue;
      }
      fusionAgregada = true;
      resultado.push({
        clave: 'fusion-3-4',
        etiqueta: 'Habitación 3 y 4',
        numeros: fusion.map((f) => f.numero).sort((a, b) => a - b),
        capacidad: fusion.reduce((a, f) => a + f.capacidad, 0),
        precioHabitacion: fusion.reduce((a, f) => a + f.precioHabitacion, 0),
        descripcion: 'Espacio compartido (un solo ambiente)',
      });
    } else {
      resultado.push(bloqueSimple(h));
    }
  }
  return resultado;
}

function bloqueSimple(h: Habitacion): Bloque {
  return { clave: `hab-${h.numero}`, etiqueta: h.nombre, numeros: [h.numero], capacidad: h.capacidad, precioHabitacion: h.precioHabitacion, descripcion: h.descripcionCamas };
}

/** ¿La reserva ocupa la noche del día (YYYY-MM-DD)? */
export const cubre = (r: Reserva, dia: string) => r.checkIn <= dia && dia < r.checkOut;

export function ocupadasEn(reservas: Reserva[], dia: string): Map<number, Reserva> {
  const m = new Map<number, Reserva>();
  for (const r of reservas) if (cubre(r, dia)) for (const n of r.habitaciones) m.set(n, r);
  return m;
}

export function nochesDe(r: Pick<Reserva, 'checkIn' | 'checkOut'>): number {
  const a = new Date(`${r.checkIn}T00:00:00`);
  const b = new Date(`${r.checkOut}T00:00:00`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

/** Habitaciones que ya tienen reserva en el rango [checkIn, checkOut). */
export function conflictos(reservas: Reserva[], numeros: number[], checkIn: string, checkOut: string, ignorarId?: number): number[] {
  const ocupados = new Set<number>();
  for (const r of reservas) {
    if (r.id === ignorarId) continue;
    if (r.checkIn < checkOut && checkIn < r.checkOut) for (const n of r.habitaciones) if (numeros.includes(n)) ocupados.add(n);
  }
  return [...ocupados].sort((a, b) => a - b);
}

export const sumarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const etiquetaHabitaciones = (numeros: number[]) =>
  numeros.length === 2 && numeros.includes(3) && numeros.includes(4) ? 'Hab. 3 y 4' : numeros.map((n) => `Hab. ${n}`).join(', ');
