import { requiereRol } from '@/lib/auth/servidor';
import { PanelReparaciones } from '@/components/PanelReparaciones';

export const dynamic = 'force-dynamic';

/** Solicitudes de reparación / mejora (ADMIN/OPERACIONES). */
export default async function PaginaReparaciones() {
  await requiereRol('OPERACIONES');
  return <PanelReparaciones />;
}
