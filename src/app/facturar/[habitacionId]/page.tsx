import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { FormularioFactura } from '@/components/FormularioFactura';
import { EMISOR } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Facturación de una habitación específica (se llega tocando la tarjeta
 * del dashboard). Si la habitación pertenece al espacio compartido 3-4,
 * se ofrecen las habitaciones hermanas para facturarlas juntas.
 */
export default async function PaginaFacturar({
  params,
}: {
  params: { habitacionId: string };
}) {
  const id = Number(params.habitacionId);
  if (!Number.isInteger(id)) notFound();

  const habitacion = await prisma.habitacion.findUnique({ where: { id } });
  if (!habitacion || !habitacion.activa) notFound();

  const hermanas = habitacion.grupoCompartido
    ? await prisma.habitacion.findMany({
        where: { grupoCompartido: habitacion.grupoCompartido, id: { not: id }, activa: true },
        orderBy: { numero: 'asc' },
      })
    : [];

  return (
    <FormularioFactura
      habitacion={JSON.parse(JSON.stringify(habitacion))}
      hermanas={JSON.parse(JSON.stringify(hermanas))}
      limiteConsumidorFinal={EMISOR.limiteConsumidorFinal}
    />
  );
}
