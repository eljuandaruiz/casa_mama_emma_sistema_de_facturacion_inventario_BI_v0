import { requiereRol } from '@/lib/auth/servidor';
import { PanelCompras } from '@/components/PanelCompras';

export const dynamic = 'force-dynamic';

/** Compras y activos con depreciación (ADMIN/OPERACIONES). */
export default async function PaginaCompras() {
  await requiereRol('OPERACIONES');
  return <PanelCompras />;
}
