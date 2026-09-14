import { redirect } from 'next/navigation';
import { getSesion } from '@/lib/auth/servidor';
import { obtenerMarca } from '@/lib/marca';
import { PantallaLogin } from '@/components/PantallaLogin';

export const dynamic = 'force-dynamic';

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  // Si ya hay sesión, no tiene sentido mostrar el login.
  const sesion = await getSesion();
  if (sesion) redirect(searchParams.next || '/');

  const marca = await obtenerMarca();
  // Fondo y logo dinámicos por hora se resuelven en el cliente (PantallaLogin).
  return <PantallaLogin next={searchParams.next} nombreNegocio={marca.nombre} logoUrl={marca.logoUrl} />;
}
