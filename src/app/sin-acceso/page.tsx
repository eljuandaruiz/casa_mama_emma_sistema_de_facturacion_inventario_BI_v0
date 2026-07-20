import Link from 'next/link';

export default function SinAcceso() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="text-5xl">🔒</span>
      <h1 className="mt-4 text-xl font-bold">Sin acceso</h1>
      <p className="mt-2 text-sm text-slate-500">
        Tu rol no tiene permiso para ver esta sección. Si crees que es un error, contacta al
        administrador.
      </p>
      <Link href="/" className="btn-primario mt-6 inline-block">
        Volver al inicio
      </Link>
    </div>
  );
}
