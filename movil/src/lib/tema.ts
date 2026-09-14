/** Tema por hora del día (mañana / tarde / noche), igual que en el sistema de PC. */
export type Franja = 'manana' | 'tarde' | 'noche';

export function franjaDelDia(hora: number = new Date().getHours()): Franja {
  if (hora >= 6 && hora < 17) return 'manana';
  if (hora >= 17 && hora < 20) return 'tarde';
  return 'noche';
}

export interface TemaFranja {
  franja: Franja;
  saludo: string;
  gradiente: string;
  texto: string;
}

export function temaDe(franja: Franja): TemaFranja {
  switch (franja) {
    case 'manana':
      return { franja, saludo: 'Buenos días', gradiente: 'linear-gradient(135deg, #fef3c7 0%, #ccfbf1 100%)', texto: '#0f766e' };
    case 'tarde':
      return { franja, saludo: 'Buenas tardes', gradiente: 'linear-gradient(135deg, #cffafe 0%, #dbeafe 100%)', texto: '#9a3412' };
    default:
      return { franja, saludo: 'Buenas noches', gradiente: 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)', texto: '#e2e8f0' };
  }
}

export function fechaLargaHoy(): string {
  const t = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
