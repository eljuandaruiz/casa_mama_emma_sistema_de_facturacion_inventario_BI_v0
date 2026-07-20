import { requiereRol } from '@/lib/auth/servidor';
import { PanelDocumentos } from '@/components/PanelDocumentos';

export const dynamic = 'force-dynamic';

/** Documentos automáticos en Google Sheets (solo ADMIN). */
export default async function PaginaDocumentos() {
  await requiereRol();
  return <PanelDocumentos />;
}
