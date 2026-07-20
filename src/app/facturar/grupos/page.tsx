import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { FormularioFactura } from '@/components/FormularioFactura';
import { EMISOR } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Facturación de GRUPOS / CASA COMPLETA. Recibe la preselección del inicio:
 *   ?habs=2,7  -> preselecciona esas habitaciones
 *   ?casa=1    -> arranca en modo Casa completa (todas)
 */
export default async function PaginaFacturarGrupos({
  searchParams,
}: {
  searchParams: { habs?: string; casa?: string };
}) {
  const habitaciones = await prisma.habitacion.findMany({
    where: { activa: true },
    orderBy: { numero: 'asc' },
  });
  if (habitaciones.length === 0) notFound();

  const serializadas = JSON.parse(JSON.stringify(habitaciones));

  // Preselección por número de habitación (?habs=2,7).
  const numeros = (searchParams.habs ?? '')
    .split(',')
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isInteger(n));
  const idsPreseleccion = habitaciones.filter((h) => numeros.includes(h.numero)).map((h) => h.id);

  const casaCompleta = searchParams.casa === '1';

  return (
    <FormularioFactura
      habitacion={serializadas[0]}
      hermanas={[]}
      habitacionesDisponibles={serializadas}
      permitirCasaCompleta
      seleccionInicial={casaCompleta ? serializadas.map((h: { id: number }) => h.id) : idsPreseleccion}
      modoInicial={casaCompleta ? 'CASA_COMPLETA' : undefined}
      limiteConsumidorFinal={EMISOR.limiteConsumidorFinal}
    />
  );
}
