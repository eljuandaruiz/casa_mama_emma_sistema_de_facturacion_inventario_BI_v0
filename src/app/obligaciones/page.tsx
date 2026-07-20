import { requiereRol } from '@/lib/auth/servidor';
import { PanelObligaciones } from '@/components/PanelObligaciones';

export const dynamic = 'force-dynamic';

/** Obligaciones tributarias y recordatorios (solo ADMIN). */
export default async function PaginaObligaciones() {
  await requiereRol();
  return <PanelObligaciones />;
}
