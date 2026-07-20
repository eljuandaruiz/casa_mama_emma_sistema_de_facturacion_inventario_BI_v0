import { requiereRol } from '@/lib/auth/servidor';
import { PanelUsuarios } from '@/components/PanelUsuarios';

export const dynamic = 'force-dynamic';

/** Gestión de usuarios y roles (solo ADMIN). */
export default async function PaginaUsuarios() {
  await requiereRol();
  return <PanelUsuarios />;
}
