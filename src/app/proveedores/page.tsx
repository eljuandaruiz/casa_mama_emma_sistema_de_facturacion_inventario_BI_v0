import { requiereRol } from '@/lib/auth/servidor';
import { PanelProveedores } from '@/components/PanelProveedores';

export const dynamic = 'force-dynamic';

/** Directorio de proveedores (ADMIN/OPERACIONES). */
export default async function PaginaProveedores() {
  await requiereRol('OPERACIONES');
  return <PanelProveedores />;
}
