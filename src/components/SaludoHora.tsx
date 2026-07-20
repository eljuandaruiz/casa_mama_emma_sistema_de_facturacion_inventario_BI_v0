'use client';

/**
 * Banner de saludo consciente de la hora local (mañana/tarde/noche), con una
 * paleta sutil distinta en cada franja. Se calcula en cliente para usar la
 * hora real del dispositivo.
 */
import { useEffect, useState } from 'react';
import { franjaDelDia, temaDe, type TemaFranja } from '@/lib/tema';

export function SaludoHora() {
  // Evita el desajuste de hidratación: se resuelve tras montar en el cliente.
  const [tema, setTema] = useState<TemaFranja | null>(null);

  useEffect(() => {
    const actualizar = () => setTema(temaDe(franjaDelDia()));
    actualizar();
    const t = setInterval(actualizar, 60_000); // por si cambia de franja
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{ background: tema?.gradiente ?? '#f1f5f9', color: tema?.texto ?? '#0f172a' }}
    >
      <p className="text-sm opacity-90">{tema ? `${tema.icono} ${tema.saludo}` : ' '}</p>
      <h1 className="text-2xl font-bold md:text-3xl">Casa Mamá Emma</h1>
    </div>
  );
}
