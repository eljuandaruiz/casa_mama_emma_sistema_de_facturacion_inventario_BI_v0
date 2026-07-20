import { requiereRol } from '@/lib/auth/servidor';
import { PanelMejoras } from '@/components/PanelMejoras';

export const dynamic = 'force-dynamic';

/** Mejoras / upgrades de capital con timeline por habitación (ADMIN/OPERACIONES). */
export default async function PaginaMejoras() {
  await requiereRol('OPERACIONES');
  return <PanelMejoras />;
}
