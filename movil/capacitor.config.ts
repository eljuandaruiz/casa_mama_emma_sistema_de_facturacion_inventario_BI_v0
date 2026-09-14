import type { CapacitorConfig } from '@capacitor/core';

// Sin server.url: la app se sirve desde los archivos empaquetados en el
// propio APK (webDir), por eso no necesita ningún servidor ni internet.
const config: CapacitorConfig = {
  appId: 'ec.casamamaemma.movil',
  appName: 'Casa Mamá Emma · Móvil',
  webDir: 'dist',
};

export default config;
