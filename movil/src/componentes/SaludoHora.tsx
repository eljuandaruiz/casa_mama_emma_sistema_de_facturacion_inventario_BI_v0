import { useEffect, useState } from 'react';
import { fechaLargaHoy, franjaDelDia, temaDe, type TemaFranja } from '../lib/tema';
import { Logo } from './Logo';

/** Banner de saludo por hora del día, calcado del dashboard del PC. */
export function SaludoHora() {
  const [tema, setTema] = useState<TemaFranja>(() => temaDe(franjaDelDia()));

  useEffect(() => {
    const t = setInterval(() => setTema(temaDe(franjaDelDia())), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="entre" style={{ borderRadius: '1rem', padding: '16px 20px', background: tema.gradiente, color: tema.texto }}>
      <div>
        <p style={{ fontSize: 14, opacity: 0.9 }}>{tema.saludo} · {fechaLargaHoy()}</p>
        <h1 style={{ marginTop: 2 }}>Casa Mamá Emma</h1>
        <p style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Baños de Agua Santa</p>
      </div>
      <Logo size={52} variante={tema.franja} />
    </div>
  );
}
