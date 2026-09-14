import { requiereRol } from '@/lib/auth/servidor';
import { PanelFinanzas } from '@/components/PanelFinanzas';

export const dynamic = 'force-dynamic';

/** Dashboard financiero maestro con proyección de impuestos (solo ADMIN). */
export default async function PaginaFinanzas() {
  await requiereRol();
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <span className="text-sm text-stone-500">Análisis con IA: descarga un archivo de texto y pégalo en ChatGPT, Claude o Gemini.</span>
        <a href="/api/finanzas/exportar-ia" className="btn-secundario text-sm">
          Exportar últimos 24 meses
        </a>
        <a href="/api/finanzas/exportar-ia?todo=1" className="btn-secundario text-sm">
          Exportar todo el historial
        </a>
      </div>
      <PanelFinanzas />
    </>
  );
}
