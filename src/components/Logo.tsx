/**
 * Logo de Casa Mamá Emma en SVG (vectorial). Tiene 3 VARIANTES según la franja
 * horaria (día/tarde/noche): equivalen a logo_day / logo_afternoon / logo_night
 * (esta última en variante clara para fondos oscuros).
 */
import type { Franja } from '@/lib/tema';

// Paleta de cada variante: [techo, cuerpo, puerta, ventana, corazón].
const PALETAS: Record<Franja, { techo: string; cuerpo: string; puerta: string; ventana: string; corazon: string }> = {
  manana: { techo: '#0d9488', cuerpo: '#14b8a6', puerta: '#0f766e', ventana: '#ccfbf1', corazon: '#fecdd3' },
  tarde: { techo: '#c2410c', cuerpo: '#ea580c', puerta: '#9a3412', ventana: '#ffedd5', corazon: '#fecdd3' },
  // Noche: variante clara (blanca) para verse sobre fondo oscuro.
  noche: { techo: '#e2e8f0', cuerpo: '#f8fafc', puerta: '#94a3b8', ventana: '#0f172a', corazon: '#f9a8d4' },
};

export function Logo({
  size = 40,
  className = '',
  variante = 'manana',
}: {
  size?: number;
  className?: string;
  variante?: Franja;
}) {
  const p = PALETAS[variante] ?? PALETAS.manana;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="Casa Mamá Emma"
    >
      {/* Techo */}
      <path d="M24 5 L43 20 H5 Z" fill={p.techo} />
      {/* Cuerpo de la casa */}
      <rect x="10" y="20" width="28" height="22" rx="2" fill={p.cuerpo} />
      {/* Puerta */}
      <rect x="21" y="30" width="6" height="12" rx="1" fill={p.puerta} />
      {/* Ventanas */}
      <rect x="13.5" y="24" width="5" height="5" rx="1" fill={p.ventana} />
      <rect x="29.5" y="24" width="5" height="5" rx="1" fill={p.ventana} />
      {/* Corazón en el techo (el toque "Mamá Emma") */}
      <path
        d="M24 11.5c-.9-1.2-3-.9-3 .9 0 1.3 1.7 2.4 3 3.6 1.3-1.2 3-2.3 3-3.6 0-1.8-2.1-2.1-3-.9Z"
        fill={p.corazon}
      />
    </svg>
  );
}
