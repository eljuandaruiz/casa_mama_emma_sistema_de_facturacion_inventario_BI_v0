/**
 * Iconos SVG inline (estilo Lucide) para el inventario visual y categorías.
 * Se usan SVGs propios en lugar de la librería lucide-react para no añadir una
 * dependencia pesada — mismo resultado visual, cero peso extra, coherente con
 * el resto del proyecto (que usa SVG inline para el logo).
 *
 * Cada icono es un <path> con stroke; comparten el mismo viewBox 24x24.
 */
import type { ReactNode } from 'react';

const PATHS: Record<string, ReactNode> = {
  sparkles: <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />,
  bed: <path d="M2 8v10M2 14h20M22 18V10a2 2 0 00-2-2H8v6" />,
  'spray-can': <path d="M9 4h4v4H9zM7 8h8v12H7zM11 2v2M14 5h1M14 8h1" />,
  wrench: <path d="M14 7a4 4 0 01-5 5l-6 6 2 2 6-6a4 4 0 005-5l-2 2-2-2 2-2z" />,
  'shower-head': <path d="M4 4l6 6M14 6a4 4 0 014 4H10a4 4 0 014-4zM9 16v.01M12 18v.01M15 16v.01" />,
  flame: <path d="M12 2c1 3 4 4 4 8a4 4 0 01-8 0c0-2 1-3 2-4 0 2 2 2 2 0 0-2 0-3 0-4z" />,
  tv: <path d="M3 7h18v12H3zM8 3l4 4 4-4" />,
  sofa: <path d="M4 11V8a2 2 0 012-2h12a2 2 0 012 2v3M2 13a2 2 0 012-2 2 2 0 012 2v4h12v-4a2 2 0 014 0v5H2z" />,
  lightbulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 00-4-10z" />,
  utensils: <path d="M4 3v7a2 2 0 002 2v9M8 3v7M6 3v3M18 3c-2 0-3 2-3 5s1 4 3 4v9" />,
  'paint-roller': <path d="M4 5h12v4H4zM16 7h3v4h-8v3M10 14h2v7h-2z" />,
  'hard-hat': <path d="M4 15a8 8 0 0116 0M10 6a2 2 0 014 0v4h-4V6zM3 15h18v3H3z" />,
  plug: <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 01-12 0V8zM12 17v5" />,
  'credit-card': <path d="M2 6h20v12H2zM2 10h20" />,
  'circle-help': <path d="M12 22a10 10 0 100-20 10 10 0 000 20zM9.5 9a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4M12 17v.01" />,
  package: <path d="M12 2l9 5v10l-9 5-9-5V7l9-5zM3 7l9 5 9-5M12 12v10" />,
};

export function Icono({ nombre, size = 20, className = '' }: { nombre: string; size?: number; className?: string }) {
  const path = PATHS[nombre] ?? PATHS.package;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {path}
    </svg>
  );
}
