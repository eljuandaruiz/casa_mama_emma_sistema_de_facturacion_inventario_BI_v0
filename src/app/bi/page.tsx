import { requiereRol } from '@/lib/auth/servidor';
import { PanelBI } from '@/components/PanelBI';

export const dynamic = 'force-dynamic';

/**
 * Vista BI/CRM OCULTA — no figura en la navegación. Solo ADMIN (el middleware
 * ya bloquea el resto). Aquí se registra la demografía del huésped y se analiza
 * cruzada con ingresos. Invisible para el huésped.
 */
export default async function PaginaBI() {
  await requiereRol(); // requiereRol() sin args => solo ADMIN
  return <PanelBI />;
}
