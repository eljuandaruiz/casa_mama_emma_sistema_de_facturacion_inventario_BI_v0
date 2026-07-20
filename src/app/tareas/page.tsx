import { requiereSesion } from '@/lib/auth/servidor';
import { PanelTareas } from '@/components/PanelTareas';

export const dynamic = 'force-dynamic';

/** Tareas/agenda — accesible para cualquier usuario autenticado. */
export default async function PaginaTareas() {
  await requiereSesion();
  return <PanelTareas />;
}
