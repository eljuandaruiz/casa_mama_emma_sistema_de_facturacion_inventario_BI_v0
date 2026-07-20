import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { FormularioFactura } from '@/components/FormularioFactura';
import { EMISOR } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Facturar resolviendo la habitación por su NÚMERO (no id) y precargando los
 * datos del cliente que llegan por querystring desde la bandeja de
 * solicitudes del portal.
 */
export default async function FacturarPorNumero({
  params,
  searchParams,
}: {
  params: { numero: string };
  searchParams: {
    tipoId?: string;
    ident?: string;
    nombre?: string;
    direccion?: string;
    email?: string;
    telefono?: string;
    nacionalidad?: string;
  };
}) {
  const numero = Number(params.numero);
  if (!Number.isInteger(numero)) notFound();

  const habitacion = await prisma.habitacion.findUnique({ where: { numero } });
  if (!habitacion || !habitacion.activa) notFound();

  const hermanas = habitacion.grupoCompartido
    ? await prisma.habitacion.findMany({
        where: { grupoCompartido: habitacion.grupoCompartido, id: { not: habitacion.id }, activa: true },
        orderBy: { numero: 'asc' },
      })
    : [];

  const tipoValido = (t?: string): '05' | '04' | '06' | undefined =>
    t === '05' || t === '04' || t === '06' ? t : undefined;

  const clienteInicial = searchParams.ident || searchParams.nombre
    ? {
        tipoId: tipoValido(searchParams.tipoId),
        identificacion: searchParams.ident,
        nombre: searchParams.nombre,
        direccion: searchParams.direccion,
        email: searchParams.email,
        telefono: searchParams.telefono,
        nacionalidad: searchParams.nacionalidad,
      }
    : undefined;

  return (
    <FormularioFactura
      habitacion={JSON.parse(JSON.stringify(habitacion))}
      hermanas={JSON.parse(JSON.stringify(hermanas))}
      clienteInicial={clienteInicial}
      limiteConsumidorFinal={EMISOR.limiteConsumidorFinal}
    />
  );
}
