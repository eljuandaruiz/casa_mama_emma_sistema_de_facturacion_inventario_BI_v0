import { requiereRol } from '@/lib/auth/servidor';
import { PanelLavanderia } from '@/components/PanelLavanderia';

export const dynamic = 'force-dynamic';

/** Gestión de lavandería: ciclos de lavado y costos (ADMIN/OPERACIONES). */
export default async function PaginaLavanderia() {
  await requiereRol('OPERACIONES');
  return <PanelLavanderia />;
}
