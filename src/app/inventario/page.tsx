import { requiereRol } from '@/lib/auth/servidor';
import { PanelInventario } from '@/components/PanelInventario';

export const dynamic = 'force-dynamic';

/** Inventario de amenidades y consumibles (ADMIN/INVENTARIO). */
export default async function PaginaInventario() {
  await requiereRol('OPERACIONES');
  return <PanelInventario />;
}
