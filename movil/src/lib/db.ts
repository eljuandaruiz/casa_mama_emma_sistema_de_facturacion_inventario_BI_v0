import Dexie, { type EntityTable } from 'dexie';

export interface Gasto {
  id?: number;
  fecha: string; // YYYY-MM-DD
  categoria: string;
  descripcion: string;
  monto: number;
  creadoEn: number;
}

export interface Ingreso {
  id?: number;
  fecha: string;
  numeroHabitacion: number | null;
  huespedes: number;
  noches: number;
  monto: number; // lo que entró (neto)
  canal: 'DIRECTO' | 'AIRBNB' | 'BOOKING' | 'OTRO';
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
  capacidad: number;
  precioHabitacion: number;
  precioPersona: number;
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
  'Varios / imprevistos',
];

export const AREAS = [
  'Habitación 1', 'Habitación 2', 'Habitación 3', 'Habitación 4',
  'Habitación 5', 'Habitación 6', 'Habitación 7',
  'Sala / área común', 'Exterior', 'General (toda la propiedad)',
];

const HABITACIONES_INICIALES: Omit<Habitacion, 'id'>[] = [
  { numero: 2, capacidad: 2, precioHabitacion: 30, precioPersona: 15 },
  { numero: 3, capacidad: 2, precioHabitacion: 30, precioPersona: 15 },
  { numero: 4, capacidad: 7, precioHabitacion: 60, precioPersona: 15 },
  { numero: 5, capacidad: 3, precioHabitacion: 40, precioPersona: 15 },
  { numero: 6, capacidad: 2, precioHabitacion: 30, precioPersona: 15 },
  { numero: 7, capacidad: 5, precioHabitacion: 50, precioPersona: 15 },
];

export const db = new Dexie('casa-mama-emma-movil') as Dexie & {
  gastos: EntityTable<Gasto, 'id'>;
  ingresos: EntityTable<Ingreso, 'id'>;
  mantenimientos: EntityTable<Mantenimiento, 'id'>;
  habitaciones: EntityTable<Habitacion, 'id'>;
};

db.version(1).stores({
  gastos: '++id, fecha',
  ingresos: '++id, fecha',
  mantenimientos: '++id, fecha',
  habitaciones: '++id, &numero',
});

db.on('populate', () => {
  db.habitaciones.bulkAdd(HABITACIONES_INICIALES);
});

export const hoyISO = () => new Date().toISOString().slice(0, 10);
