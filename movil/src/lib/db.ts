import Dexie, { type EntityTable } from 'dexie';
import { obligacionesIniciales, type ObligacionBase } from './obligaciones';

export interface Gasto {
  id?: number;
  fecha: string; // YYYY-MM-DD
  categoria: string;
  descripcion: string;
  monto: number;
  creadoEn: number;
}

export type Canal = 'DIRECTO' | 'AIRBNB' | 'BOOKING' | 'OTRO';

export interface Ingreso {
  id?: number;
  fecha: string;
  numeroHabitacion: number | null;
  huespedes: number;
  noches: number;
  monto: number; // lo que entró (neto)
  canal: Canal;
  notas: string;
  creadoEn: number;
}

export interface FotoTrabajo {
  descripcion: string;
  imagen: string; // data URI
}

export interface Mantenimiento {
  id?: number;
  titulo: string;
  area: string;
  descripcion: string;
  fecha: string;
  costoMateriales: number;
  costoManoObra: number;
  fotos: FotoTrabajo[];
  creadoEn: number;
}

export interface Habitacion {
  id?: number;
  numero: number;
  nombre: string;
  descripcionCamas: string;
  capacidad: number;
  precioHabitacion: number;
  precioPersona: number;
}

export interface Reserva {
  id?: number;
  huesped: string;
  telefono: string;
  habitaciones: number[];
  checkIn: string;
  checkOut: string;
  huespedes: number;
  canal: Canal;
  montoAcordado: number;
  cobrada: boolean;
  notas: string;
  creadoEn: number;
}

export interface Obligacion extends ObligacionBase {
  id?: number;
}

/** Registro genérico de los módulos definidos en lib/modulos.ts (inventario, compras, huéspedes…). */
export interface Registro {
  id?: number;
  modulo: string;
  datos: Record<string, unknown>;
  creadoEn: number;
}

export interface Ajuste {
  clave: string;
  valor: unknown;
}

export const CATEGORIAS_GASTO = [
  'Amenidades y aseo',
  'Lencería (sábanas, toallas)',
  'Limpieza',
  'Plomería y baño',
  'Electrodomésticos',
  'Muebles y decoración',
  'Servicios fijos (agua, luz, internet)',
  'Mano de obra',
  'Comisiones de plataforma',
  'Impuestos y permisos',
  'Varios / imprevistos',
];

export const AREAS = [
  'Habitación 1 (bodega)', 'Habitación 2', 'Habitación 3', 'Habitación 4',
  'Habitación 5', 'Habitación 6', 'Habitación 7',
  'Sala / área común', 'Exterior', 'General (toda la propiedad)',
];

export const HABITACIONES_INICIALES: Omit<Habitacion, 'id'>[] = [
  { numero: 2, nombre: 'Habitación 2', descripcionCamas: '1 cama matrimonial', capacidad: 2, precioHabitacion: 30, precioPersona: 15 },
  { numero: 3, nombre: 'Habitación 3', descripcionCamas: '1 cama matrimonial · espacio compartido con Hab. 4', capacidad: 2, precioHabitacion: 30, precioPersona: 15 },
  { numero: 4, nombre: 'Habitación 4', descripcionCamas: '1 matrimonial, 1 simple, 2 literas · espacio compartido con Hab. 3', capacidad: 7, precioHabitacion: 60, precioPersona: 15 },
  { numero: 5, nombre: 'Habitación 5', descripcionCamas: '1 matrimonial, 1 simple', capacidad: 3, precioHabitacion: 40, precioPersona: 15 },
  { numero: 6, nombre: 'Habitación 6', descripcionCamas: '1 cama matrimonial', capacidad: 2, precioHabitacion: 30, precioPersona: 15 },
  { numero: 7, nombre: 'Habitación 7', descripcionCamas: '1 matrimonial, 1 simple, 1 litera', capacidad: 5, precioHabitacion: 50, precioPersona: 15 },
];

export const db = new Dexie('casa-mama-emma-movil') as Dexie & {
  gastos: EntityTable<Gasto, 'id'>;
  ingresos: EntityTable<Ingreso, 'id'>;
  mantenimientos: EntityTable<Mantenimiento, 'id'>;
  habitaciones: EntityTable<Habitacion, 'id'>;
  reservas: EntityTable<Reserva, 'id'>;
  obligaciones: EntityTable<Obligacion, 'id'>;
  registros: EntityTable<Registro, 'id'>;
  ajustes: EntityTable<Ajuste, 'clave'>;
};

db.version(1).stores({
  gastos: '++id, fecha',
  ingresos: '++id, fecha',
  mantenimientos: '++id, fecha',
  habitaciones: '++id, &numero',
});

db.version(2)
  .stores({
    gastos: '++id, fecha',
    ingresos: '++id, fecha',
    mantenimientos: '++id, fecha',
    habitaciones: '++id, &numero',
    reservas: '++id, checkIn, checkOut',
    obligaciones: '++id, proximoVencimiento',
  })
  .upgrade(async (tx) => {
    // Instalaciones de la v1: completar nombre/camas y sembrar obligaciones.
    await tx.table('habitaciones').toCollection().modify((h: Habitacion) => {
      const base = HABITACIONES_INICIALES.find((x) => x.numero === h.numero);
      if (!h.nombre) h.nombre = base?.nombre ?? `Habitación ${h.numero}`;
      if (!h.descripcionCamas) h.descripcionCamas = base?.descripcionCamas ?? '';
    });
    if ((await tx.table('obligaciones').count()) === 0) await tx.table('obligaciones').bulkAdd(obligacionesIniciales());
  });

db.version(3).stores({
  gastos: '++id, fecha',
  ingresos: '++id, fecha',
  mantenimientos: '++id, fecha',
  habitaciones: '++id, &numero',
  reservas: '++id, checkIn, checkOut',
  obligaciones: '++id, proximoVencimiento',
  registros: '++id, modulo, creadoEn',
  ajustes: 'clave',
});

db.on('populate', () => {
  db.habitaciones.bulkAdd(HABITACIONES_INICIALES);
  db.obligaciones.bulkAdd(obligacionesIniciales());
});

export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
