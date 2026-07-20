import { requiereRol } from '@/lib/auth/servidor';
import { PanelMantenimiento } from '@/components/PanelMantenimiento';

export const dynamic = 'force-dynamic';

/** Módulo de mantenimiento/mejoras (ADMIN/INVENTARIO). */
export default async function PaginaMantenimiento() {
  await requiereRol('OPERACIONES');
  return <PanelMantenimiento />;
}
