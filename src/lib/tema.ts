/**
 * Tema por hora del día: mañana / tarde / noche. Paletas sutiles y legibles
 * (fondo suave + acento) para indicar el momento sin sacrificar contraste.
 */
export type Franja = 'manana' | 'tarde' | 'noche';

/**
 * Franja horaria según la hora local. Rangos del negocio:
 *   Día    06:00 – 16:59
 *   Tarde  17:00 – 19:59
 *   Noche  20:00 – 05:59
 */
export function franjaDelDia(hora: number = new Date().getHours()): Franja {
  if (hora >= 6 && hora < 17) return 'manana';
  if (hora >= 17 && hora < 20) return 'tarde';
  return 'noche';
}

export interface TemaFranja {
  franja: Franja;
  saludo: string;
  icono: string;
  /** Degradado sutil para el banner de saludo. */
  gradiente: string;
  /** Color de texto legible sobre el degradado. */
  texto: string;
  /** Fondo de pantalla completa (login/home): degradado amplio de la franja. */
  fondoPantalla: string;
  /** ¿El fondo de pantalla es oscuro? (para elegir texto claro en el login). */
  fondoOscuro: boolean;
}

export function temaDe(franja: Franja): TemaFranja {
  switch (franja) {
    case 'manana':
      return {
        franja,
        saludo: 'Buenos días',
        icono: '🌅',
        gradiente: 'linear-gradient(135deg, #fef3c7 0%, #ccfbf1 100%)',
        texto: '#0f766e',
        // Amanecer/día: cielo claro cálido.
        fondoPantalla: 'linear-gradient(160deg, #fef9c3 0%, #a7f3d0 55%, #5eead4 100%)',
        fondoOscuro: false,
      };
    case 'tarde':
      return {
        franja,
        saludo: 'Buenas tardes',
        icono: '🌇',
        gradiente: 'linear-gradient(135deg, #cffafe 0%, #dbeafe 100%)',
        texto: '#9a3412',
        // Atardecer: tonos naranja/durazno.
        fondoPantalla: 'linear-gradient(160deg, #fed7aa 0%, #fb923c 55%, #f97316 100%)',
        fondoOscuro: false,
      };
    default:
      return {
        franja,
        saludo: 'Buenas noches',
        icono: '🌙',
        gradiente: 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)',
        texto: '#e2e8f0',
        // Noche: azul oscuro profundo.
        fondoPantalla: 'linear-gradient(160deg, #0f172a 0%, #1e293b 55%, #134e4a 100%)',
        fondoOscuro: true,
      };
  }
}
