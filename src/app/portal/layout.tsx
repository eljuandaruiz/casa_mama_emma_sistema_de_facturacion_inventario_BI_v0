/**
 * Layout propio del portal público: siempre limpio (sin navegación interna),
 * aunque quien lo abra tenga sesión de staff. Es la cara pública para el
 * huésped.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-slate-50">{children}</div>;
}
