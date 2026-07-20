import { requiereRol } from '@/lib/auth/servidor';
import { PanelImportarXml } from '@/components/PanelImportarXml';

export const dynamic = 'force-dynamic';

/** Cuentas por pagar: importación de facturas XML recibidas (ADMIN/OPERACIONES). */
export default async function PaginaGastosXml() {
  await requiereRol('OPERACIONES');
  return <PanelImportarXml />;
}
