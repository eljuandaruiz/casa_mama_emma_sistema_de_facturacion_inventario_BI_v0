/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Solo para el empaquetado Electron (scripts/build-electron.mjs); la versión web no cambia.
  output: process.env.ELECTRON_BUILD ? 'standalone' : undefined,
  // pdfmake, node-forge y bwip-js se ejecutan solo en el servidor (rutas API)
  experimental: {
    serverComponentsExternalPackages: ['pdfmake', 'node-forge', 'bwip-js', 'exceljs'],
  },
};

export default nextConfig;
