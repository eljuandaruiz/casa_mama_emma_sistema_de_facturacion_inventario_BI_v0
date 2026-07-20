/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfmake, node-forge y bwip-js se ejecutan solo en el servidor (rutas API)
  experimental: {
    serverComponentsExternalPackages: ['pdfmake', 'node-forge', 'bwip-js', 'exceljs'],
  },
};

export default nextConfig;
