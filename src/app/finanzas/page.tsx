import { requiereRol } from '@/lib/auth/servidor';
import { PanelFinanzas } from '@/components/PanelFinanzas';

export const dynamic = 'force-dynamic';

/** Dashboard financiero maestro con proyección de impuestos (solo ADMIN). */
export default async function PaginaFinanzas() {
  await requiereRol();
  return <PanelFinanzas />;
}
