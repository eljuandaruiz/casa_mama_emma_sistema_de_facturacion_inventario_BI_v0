import { requiereRol } from '@/lib/auth/servidor';
import { BandejaSolicitudes } from '@/components/BandejaSolicitudes';

export const dynamic = 'force-dynamic';

/** Bandeja interna de solicitudes del portal (ADMIN/FACTURADOR). */
export default async function PaginaSolicitudes() {
  await requiereRol('FACTURADOR');
  return <BandejaSolicitudes />;
}
