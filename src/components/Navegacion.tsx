'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { puedeAccederRuta, type Rol } from '@/lib/auth/roles';
import { temaDeRol } from '@/lib/auth/temaRol';
import { Logo } from '@/components/Logo';

/**
 * Logo del colibrí (formato 1×1): si existe /logo.svg en public/ se usa ese
 * archivo; si no, cae al logo SVG interno de la casita.
 */
function LogoColibri({ size = 44 }: { size?: number }) {
  const [fallback, setFallback] = useState(false);
  if (fallback) return <Logo size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt="Casa Mamá Emma"
      width={size}
      height={size}
      className="rounded-xl"
      onError={() => setFallback(true)}
    />
  );
}

interface Ruta {
  href: string;
  etiqueta: string;
  icono: string;
}

/**
 * Navegación AGRUPADA y COLAPSABLE:
 *  · Expandida: colibrí + "Casa Mamá Emma" + grupos desplegables (<details>).
 *  · Colapsada: solo el colibrí + una tira vertical de iconos (con tooltip).
 * El estado se recuerda en localStorage. RBAC: solo se ven las rutas del rol.
 */
const GRUPOS: { titulo: string; rutas: Ruta[] }[] = [
  {
    titulo: 'Recepción',
    rutas: [
      { href: '/reservas', etiqueta: 'Reservas', icono: '📅' },
      { href: '/ocupacion', etiqueta: 'Ocupación', icono: '🗓️' },
      { href: '/solicitudes', etiqueta: 'Portal', icono: '📥' },
      { href: '/facturas', etiqueta: 'Facturas', icono: '🧾' },
      { href: '/productos', etiqueta: 'Productos', icono: '🏷️' },
      { href: '/caja', etiqueta: 'Caja diaria', icono: '💰' },
    ],
  },
  {
    titulo: 'Operación',
    rutas: [
      { href: '/inventario', etiqueta: 'Inventario', icono: '📦' },
      { href: '/reparaciones', etiqueta: 'Reparaciones', icono: '🛠️' },
      { href: '/mantenimiento', etiqueta: 'Mantenimiento', icono: '🔧' },
      { href: '/mejoras', etiqueta: 'Mejoras', icono: '⬆️' },
      { href: '/lavanderia', etiqueta: 'Lavandería', icono: '🧺' },
      { href: '/compras', etiqueta: 'Compras', icono: '🛒' },
      { href: '/proveedores', etiqueta: 'Proveedores', icono: '🏪' },
      { href: '/tareas', etiqueta: 'Tareas', icono: '📋' },
    ],
  },
  {
    titulo: 'Finanzas',
    rutas: [
      { href: '/gastos', etiqueta: 'Gastos', icono: '💸' },
      { href: '/rimpe', etiqueta: 'RIMPE', icono: '🧮' },
      { href: '/finanzas', etiqueta: 'Finanzas', icono: '📈' },
      { href: '/estadisticas', etiqueta: 'Reportes', icono: '📊' },
      { href: '/obligaciones', etiqueta: 'Impuestos', icono: '📌' },
      { href: '/documentos', etiqueta: 'Documentos', icono: '📄' },
      { href: '/bi', etiqueta: 'Insights / BI', icono: '🔎' },
    ],
  },
  {
    titulo: 'Sistema',
    rutas: [
      { href: '/integraciones', etiqueta: 'Integrar', icono: '🔌' },
      { href: '/usuarios', etiqueta: 'Usuarios', icono: '👤' },
      { href: '/ajustes', etiqueta: 'Ajustes', icono: '⚙️' },
    ],
  },
];

export function Navegacion({ rol, nombre }: { rol: Rol; nombre: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const temaRol = temaDeRol(rol);
  const activa = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  // Estado de colapso (recordado entre sesiones).
  const [colapsado, setColapsado] = useState(false);
  useEffect(() => {
    setColapsado(localStorage.getItem('cme_sidebar_colapsado') === '1');
  }, []);
  const alternarColapso = () => {
    setColapsado((v) => {
      const nuevo = !v;
      localStorage.setItem('cme_sidebar_colapsado', nuevo ? '1' : '0');
      return nuevo;
    });
  };

  // Filtra grupos/rutas según permisos del rol; elimina grupos vacíos.
  const grupos = GRUPOS.map((g) => ({ ...g, rutas: g.rutas.filter((r) => puedeAccederRuta(rol, r.href)) }))
    .filter((g) => g.rutas.length > 0);

  const rutasPlanas: Ruta[] = [{ href: '/', etiqueta: 'Inicio', icono: '🏠' }, ...grupos.flatMap((g) => g.rutas)];

  const salir = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  return (
    <>
      {/* ---------- Sidebar escritorio ---------- */}
      <aside
        className={`hidden md:flex md:flex-col md:border-r md:border-slate-200 md:bg-white md:min-h-dvh transition-all duration-200 ${
          colapsado ? 'md:w-16' : 'md:w-60'
        }`}
      >
        {/* Encabezado: colibrí (+ nombre si está expandido) + botón colapsar */}
        <div className={`flex items-center gap-2 px-3 pt-5 ${colapsado ? 'flex-col' : 'justify-between pl-4 pr-2'}`}>
          <div className="flex items-center gap-2">
            <LogoColibri size={colapsado ? 40 : 36} />
            {!colapsado && (
              <div className="leading-tight">
                <p className="text-sm font-bold text-brand-700">Casa Mamá Emma</p>
                <p className="text-[10px] text-slate-400">Baños de Agua Santa</p>
              </div>
            )}
          </div>
          <button
            onClick={alternarColapso}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
            title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
          >
            {colapsado ? '»' : '«'}
          </button>
        </div>

        {/* Badge de ROL (rojo=Admin, azul=Facturador, verde=Operaciones) */}
        <div className={`pb-3 pt-3 ${colapsado ? 'px-2' : 'px-3'}`}>
          <div
            className={`rounded-xl text-center font-bold uppercase tracking-wider ${colapsado ? 'py-1 text-[9px]' : 'px-4 py-2 text-xs'}`}
            style={{ backgroundColor: temaRol.color, color: temaRol.textoSobreColor }}
            title={temaRol.etiqueta}
          >
            {colapsado ? temaRol.etiqueta.slice(0, 3) : temaRol.etiqueta}
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex flex-col gap-1 overflow-y-auto px-2 pb-4">
          {colapsado ? (
            // Colapsada: tira vertical de iconos con tooltip.
            rutasPlanas.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                title={r.etiqueta}
                className={`flex items-center justify-center rounded-xl py-2.5 text-xl transition ${
                  activa(r.href) ? 'bg-brand-50' : 'hover:bg-slate-50'
                }`}
              >
                <span aria-hidden>{r.icono}</span>
              </Link>
            ))
          ) : (
            <>
              <Link
                href="/"
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  activa('/') ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span aria-hidden>🏠</span>
                Inicio
              </Link>
              {grupos.map((g) => (
                <details key={g.titulo} open={g.rutas.some((r) => activa(r.href))} className="group">
                  <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    {g.titulo}
                    <span className="text-slate-300 transition-transform group-open:rotate-90" aria-hidden>›</span>
                  </summary>
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {g.rutas.map((r) => (
                      <Link
                        key={r.href}
                        href={r.href}
                        className={`flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition ${
                          activa(r.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span aria-hidden>{r.icono}</span>
                        {r.etiqueta}
                      </Link>
                    ))}
                  </div>
                </details>
              ))}
            </>
          )}
        </nav>

        {/* Usuario + salir */}
        <div className={`mt-auto border-t border-slate-100 py-4 ${colapsado ? 'px-2' : 'px-4'}`}>
          {!colapsado && (
            <>
              <p className="truncate text-sm font-medium text-slate-700">{nombre}</p>
              <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">{rol}</p>
            </>
          )}
          <button
            onClick={salir}
            className={`btn-secundario w-full text-sm ${colapsado ? 'px-0' : ''}`}
            title="Cerrar sesión"
          >
            {colapsado ? '🚪' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      {/* ---------- Barra inferior móvil (scroll horizontal) ---------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex overflow-x-auto">
          {rutasPlanas.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className={`flex min-w-[68px] flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                activa(r.href) ? 'text-brand-700' : 'text-slate-500'
              }`}
            >
              <span className="text-xl leading-none" aria-hidden>
                {r.icono}
              </span>
              {r.etiqueta}
            </Link>
          ))}
          <button
            onClick={salir}
            className="flex min-w-[68px] flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"
          >
            <span className="text-xl leading-none" aria-hidden>
              🚪
            </span>
            Salir
          </button>
        </div>
      </nav>
    </>
  );
}
