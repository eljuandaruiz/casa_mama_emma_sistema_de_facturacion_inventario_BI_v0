import { FormularioRestablecer } from '@/components/FormularioRestablecer';

export const dynamic = 'force-dynamic';

/** Página pública: fijar nueva contraseña con el token recibido por correo. */
export default function PaginaRestablecer({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-center text-xl font-bold text-brand-700">Nueva contraseña</h1>
        <FormularioRestablecer token={searchParams.token ?? ''} />
      </div>
    </main>
  );
}
