import { FormularioPortal } from '@/components/FormularioPortal';

export const metadata = {
  title: 'Casa Mamá Emma · Datos de facturación',
};

/**
 * PORTAL PÚBLICO del huésped: ingresa sus datos de facturación antes o al
 * llegar. No requiere sesión (el middleware lo exceptúa). No muestra precios
 * ni información interna.
 */
export default function PaginaPortal() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-8">
      <header className="mb-6 text-center">
        <p className="text-2xl font-bold text-brand-700">Casa Mamá Emma</p>
        <p className="text-sm text-slate-500">Baños de Agua Santa</p>
      </header>
      <FormularioPortal />
      <p className="mt-6 text-center text-xs text-slate-400">
        Tus datos se usan únicamente para emitir tu factura conforme a la normativa del SRI.
      </p>
    </div>
  );
}
