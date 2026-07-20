import { requiereRol } from '@/lib/auth/servidor';
import { PanelCaja } from '@/components/PanelCaja';

export const dynamic = 'force-dynamic';

/** Caja diaria / cierre de turno (ADMIN/FACTURADOR). */
export default async function PaginaCaja() {
  await requiereRol('FACTURADOR');
  return <PanelCaja />;
}
