import { prisma } from '@/lib/db';
import { EMISOR } from '@/lib/config';

export interface Marca {
  nombre: string;
  logoUrl: string | null;
}

/** Nombre e ícono del negocio, editables en /ajustes. Cae al .env y al logo interno. */
export async function obtenerMarca(): Promise<Marca> {
  const config = await prisma.configuracion.findUnique({
    where: { id: 1 },
    select: { nombreComercial: true, logoUrl: true },
  });
  return {
    nombre: config?.nombreComercial?.trim() || EMISOR.nombreComercial,
    logoUrl: config?.logoUrl || null,
  };
}
