import { requiereRol } from '@/lib/auth/servidor';
import { PanelOcupacion } from '@/components/PanelOcupacion';

export const dynamic = 'force-dynamic';

/** Calendario de ocupación por habitación (ADMIN/FACTURADOR). */
export default async function PaginaOcupacion() {
  await requiereRol('FACTURADOR');
  return <PanelOcupacion />;
}
