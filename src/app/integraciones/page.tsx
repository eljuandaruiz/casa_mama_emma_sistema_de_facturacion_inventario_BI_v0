import { requiereRol } from '@/lib/auth/servidor';
import { PanelIntegraciones } from '@/components/PanelIntegraciones';

export const dynamic = 'force-dynamic';

/** Configuración de integraciones externas (solo ADMIN). */
export default async function PaginaIntegraciones() {
  await requiereRol(); // solo ADMIN (requiereRol sin args => cualquier sesión; ADMIN pasa)
  return <PanelIntegraciones />;
}
