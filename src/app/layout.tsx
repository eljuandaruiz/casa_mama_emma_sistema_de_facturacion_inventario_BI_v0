import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navegacion } from '@/components/Navegacion';
import { getSesion } from '@/lib/auth/servidor';
import { temaDeRol } from '@/lib/auth/temaRol';
import { puedeAccederRuta } from '@/lib/auth/roles';
import { ControlTema } from '@/components/ControlTema';
import { AlertaStock } from '@/components/AlertaStock';
import { obtenerMarca } from '@/lib/marca';

export async function generateMetadata(): Promise<Metadata> {
  const marca = await obtenerMarca();
  return {
    title: `${marca.nombre} · Facturación`,
    description: `Gestión y facturación electrónica SRI para ${marca.nombre}, Baños de Agua Santa`,
  };
}

/** viewport-fit=cover: usa toda la pantalla en iPhone 14 Pro Max / Note 10 Lite */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f766e',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [sesion, marca] = await Promise.all([getSesion(), obtenerMarca()]);
  const tema = sesion ? temaDeRol(sesion.rol) : null;

  return (
    <html lang="es">
      <body>
        {/* Tema claro/oscuro (auto de noche) en toda la app */}
        <ControlTema />
        {sesion && tema ? (
          <div className="min-h-dvh md:flex">
            {/* Sidebar en escritorio / barra inferior en móvil (según rol) */}
            <Navegacion rol={sesion.rol} nombre={sesion.nombre} nombreNegocio={marca.nombre} logoUrl={marca.logoUrl} />
            <main className="flex-1 pb-24 md:pb-8">
              {/* Barra de color por ROL — SOLO en móvil (sin sidebar); en
                  escritorio el indicador vive a la izquierda, en el sidebar. */}
              <div
                className="flex items-center justify-between px-4 py-1.5 text-xs font-semibold md:hidden"
                style={{ backgroundColor: tema.color, color: tema.textoSobreColor }}
              >
                <span>{marca.nombre} · ERP</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5">
                  {tema.etiqueta} · {sesion.nombre}
                </span>
              </div>
              {/* Aviso global de reposición de inventario (solo roles con acceso) */}
              {puedeAccederRuta(sesion.rol, '/inventario') && <AlertaStock />}
              <div className="mx-auto max-w-5xl px-4 pt-4 md:px-8 md:pt-8">{children}</div>
            </main>
          </div>
        ) : (
          // Sin sesión (login, sin-acceso, portal): sin chrome de navegación.
          <main className="min-h-dvh">{children}</main>
        )}
      </body>
    </html>
  );
}
