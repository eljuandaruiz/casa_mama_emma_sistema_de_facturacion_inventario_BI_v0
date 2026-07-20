import { requiereRol } from '@/lib/auth/servidor';
import { PanelProductos } from '@/components/PanelProductos';

export const dynamic = 'force-dynamic';

/** Catálogo de productos/servicios facturables (ADMIN/FACTURADOR). */
export default async function PaginaProductos() {
  await requiereRol('FACTURADOR');
  return <PanelProductos />;
}
