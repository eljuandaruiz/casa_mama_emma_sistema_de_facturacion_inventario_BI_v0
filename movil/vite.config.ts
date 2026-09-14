import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// App 100% cliente (sin servidor): todo el estado vive en IndexedDB del
// dispositivo. `base: ''` genera rutas relativas para que funcione tanto
// servida por Capacitor (file://) como por un navegador normal.
export default defineConfig({
  plugins: [react()],
  base: '',
  build: {
    outDir: 'dist',
  },
});
