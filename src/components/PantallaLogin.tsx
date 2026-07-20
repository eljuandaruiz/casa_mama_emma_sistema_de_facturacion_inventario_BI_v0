'use client';

/**
 * Pantalla de login con FONDO y LOGO dinámicos según la hora local del cliente:
 *   Día (06:00–16:59) → fondo claro cálido + logo día.
 *   Tarde (17:00–19:59) → fondo naranja + logo tarde.
 *   Noche (20:00–05:59) → fondo azul oscuro + logo noche (variante clara).
 * La franja se calcula en el cliente para usar su hora real.
 */
import { useEffect, useState } from 'react';
import { franjaDelDia, temaDe, type TemaFranja } from '@/lib/tema';
import { Logo } from '@/components/Logo';
import { FormularioLogin } from '@/components/FormularioLogin';

export function PantallaLogin({ next }: { next?: string }) {
  const [tema, setTema] = useState<TemaFranja | null>(null);

  useEffect(() => {
    const aplicar = () => setTema(temaDe(franjaDelDia()));
    aplicar();
    const t = setInterval(aplicar, 60_000); // por si cambia de franja
    return () => clearInterval(t);
  }, []);

  const oscuro = tema?.fondoOscuro ?? false;

  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4 transition-[background] duration-500"
      style={{ background: tema?.fondoPantalla ?? '#f1f5f9' }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={72} className="mb-2" variante={tema?.franja ?? 'manana'} />
          <p className={`text-2xl font-bold ${oscuro ? 'text-white' : 'text-brand-800'}`}>Casa Mamá Emma</p>
          <p className={`text-sm ${oscuro ? 'text-slate-200' : 'text-slate-600'}`}>
            {tema ? `${tema.icono} ${tema.saludo}` : ' '} · Baños de Agua Santa
          </p>
        </div>
        <FormularioLogin next={next} />
      </div>
    </div>
  );
}
