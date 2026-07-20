import type { Config } from 'tailwindcss';

/**
 * Paleta inspirada en el dashboard de anfitrión de Airbnb (tarjetas blancas,
 * bordes suaves, acento coral) y en SRI Móvil (azul institucional para
 * estados tributarios). Optimizada para pantallas grandes de móvil
 * (iPhone 14 Pro Max: 430px, Galaxy Note 10 Lite: 412px).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  // Modo oscuro por clase `dark` en <html> (lo activa ControlTema de noche).
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          900: '#134e4a',
        },
        coral: {
          50: '#fff1f2',
          500: '#f43f5e',
          600: '#e11d48',
        },
        sri: {
          blue: '#1e3a8a',
          light: '#eff6ff',
        },
      },
      borderRadius: {
        card: '1.25rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(16,24,40,.08), 0 4px 12px rgba(16,24,40,.06)',
        cardHover: '0 4px 8px rgba(16,24,40,.10), 0 12px 24px rgba(16,24,40,.10)',
      },
      screens: {
        xs: '390px',
      },
    },
  },
  plugins: [],
};

export default config;
