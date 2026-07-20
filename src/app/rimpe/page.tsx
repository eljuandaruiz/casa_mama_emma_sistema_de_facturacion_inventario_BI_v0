import { requiereRol } from '@/lib/auth/servidor';
import { PanelRimpe } from '@/components/PanelRimpe';

export const dynamic = 'force-dynamic';

/** Control simple RIMPE sin facturación (solo ADMIN). */
export default async function PaginaRimpe() {
  await requiereRol();
  return <PanelRimpe />;
}
