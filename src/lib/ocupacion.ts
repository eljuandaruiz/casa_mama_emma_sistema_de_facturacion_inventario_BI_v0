import { prisma } from '@/lib/db';

/**
 * OCUPACIÓN — cruce de dos fuentes de "habitación ocupada tal fecha":
 *  1. Reserva (importadas por iCal de Airbnb, o creadas a mano como "hold").
 *  2. Factura (estadías ya facturadas, con checkIn/checkOut + habitación).
 * Sirve para pintar el calendario y para evitar overbooking al crear un
 * hold manual o una factura para una habitación ya comprometida.
 */

export interface BloqueOcupacion {
  origen: 'AIRBNB' | 'BOOKING' | 'MANUAL' | 'FACTURA';
  etiqueta: string;
  checkIn: Date;
  checkOut: Date;
  numeroHabitacion: number | null;
  reservaId?: number;
  facturaId?: string;
}

const seSolapan = (aIni: Date, aFin: Date, bIni: Date, bFin: Date) => aIni < bFin && aFin > bIni;

/** Trae todos los bloques de ocupación (Reserva + Factura) que caen dentro del rango [desde, hasta). */
export async function listarOcupaciones(desde: Date, hasta: Date): Promise<BloqueOcupacion[]> {
  const [reservas, facturas] = await Promise.all([
    prisma.reserva.findMany({ where: { checkIn: { lt: hasta }, checkOut: { gt: desde } } }),
    prisma.factura.findMany({
      where: {
        anulada: false,
        checkIn: { not: null, lt: hasta },
        checkOut: { not: null, gt: desde },
      },
      include: { detalles: { include: { habitacion: true } } },
    }),
  ]);

  const bloques: BloqueOcupacion[] = reservas.map((r) => ({
    origen: (r.fuente as BloqueOcupacion['origen']) ?? 'MANUAL',
    etiqueta: r.huespedNombre ?? r.resumen ?? 'Reserva',
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    numeroHabitacion: r.numeroHabitacion,
    reservaId: r.id,
  }));

  for (const f of facturas) {
    const numerosVistos = new Set<number>();
    for (const d of f.detalles) {
      if (!d.habitacion || numerosVistos.has(d.habitacion.numero)) continue;
      numerosVistos.add(d.habitacion.numero);
      bloques.push({
        origen: 'FACTURA',
        etiqueta: `Factura ${f.numeroCompleto}`,
        checkIn: f.checkIn!,
        checkOut: f.checkOut!,
        numeroHabitacion: d.habitacion.numero,
        facturaId: f.id,
      });
    }
  }

  return bloques;
}

/**
 * Busca el primer bloque existente que se solape con [checkIn, checkOut) en
 * la misma habitación. `excluirReservaId` permite que un hold se compare
 * consigo mismo al editarlo sin marcarse como su propio conflicto.
 */
export async function buscarConflicto(
  numeroHabitacion: number,
  checkIn: Date,
  checkOut: Date,
  excluirReservaId?: number,
): Promise<BloqueOcupacion | null> {
  const bloques = await listarOcupaciones(checkIn, checkOut);
  const conflicto = bloques.find(
    (b) =>
      b.numeroHabitacion === numeroHabitacion &&
      b.reservaId !== excluirReservaId &&
      seSolapan(b.checkIn, b.checkOut, checkIn, checkOut),
  );
  return conflicto ?? null;
}
