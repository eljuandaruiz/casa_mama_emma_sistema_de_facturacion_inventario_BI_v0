/**
 * RBAC — definición de roles y matriz de permisos por sección.
 * Fuente única de verdad usada por el middleware (protección de rutas)
 * y por la UI (mostrar/ocultar navegación).
 *
 * TRES roles (según decisión del negocio):
 *   ADMIN       -> ve y hace TODO (facturación, finanzas, BI, operación, ajustes)
 *   FACTURADOR  -> SOLO facturación: emitir/ver facturas, reservas y portal
 *   OPERACIONES -> operación física del hospedaje: mantenimiento, solicitudes
 *                  de reparación, inventario y compras/activos
 */

export const ROLES = {
  ADMIN: 'ADMIN',
  FACTURADOR: 'FACTURADOR',
  OPERACIONES: 'OPERACIONES',
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];

export const ROLES_LISTA: { valor: Rol; etiqueta: string; descripcion: string }[] = [
  { valor: 'ADMIN', etiqueta: 'Administrador', descripcion: 'Acceso total al sistema' },
  { valor: 'FACTURADOR', etiqueta: 'Facturador', descripcion: 'Facturas emitidas y recibidas, reservas' },
  { valor: 'OPERACIONES', etiqueta: 'Operaciones', descripcion: 'Mantenimiento, inventario y compras' },
];

/**
 * Secciones protegidas de la app. A cada prefijo de ruta le corresponde la
 * lista de roles que pueden acceder. ADMIN siempre puede todo. Las rutas que
 * NO figuran aquí quedan accesibles para cualquier usuario autenticado.
 */
export const PERMISOS_RUTA: { prefijo: string; roles: Rol[] }[] = [
  // --- Facturación (ADMIN + FACTURADOR) ---
  { prefijo: '/facturar', roles: ['ADMIN', 'FACTURADOR'] },
  { prefijo: '/facturas', roles: ['ADMIN', 'FACTURADOR'] },
  { prefijo: '/solicitudes', roles: ['ADMIN', 'FACTURADOR'] }, // solicitudes del portal de huéspedes
  { prefijo: '/reservas', roles: ['ADMIN', 'FACTURADOR'] },
  { prefijo: '/ocupacion', roles: ['ADMIN', 'FACTURADOR'] }, // calendario de disponibilidad (nuevo)
  { prefijo: '/caja', roles: ['ADMIN', 'FACTURADOR'] }, // caja diaria / cierre de turno (nuevo)
  { prefijo: '/productos', roles: ['ADMIN', 'FACTURADOR'] }, // catálogo facturable (nuevo)
  // --- Operación física del hospedaje (ADMIN + OPERACIONES) ---
  { prefijo: '/inventario', roles: ['ADMIN', 'OPERACIONES'] },
  { prefijo: '/mantenimiento', roles: ['ADMIN', 'OPERACIONES'] },
  { prefijo: '/mejoras', roles: ['ADMIN', 'OPERACIONES'] }, // upgrades de capital + timeline
  { prefijo: '/lavanderia', roles: ['ADMIN', 'OPERACIONES'] },
  { prefijo: '/reparaciones', roles: ['ADMIN', 'OPERACIONES'] }, // solicitudes de reparación (nuevo)
  { prefijo: '/compras', roles: ['ADMIN', 'OPERACIONES'] }, // compras / activos (nuevo)
  { prefijo: '/gastos', roles: ['ADMIN', 'OPERACIONES'] },
  // --- Finanzas / dirección (solo ADMIN) ---
  { prefijo: '/estadisticas', roles: ['ADMIN'] },
  { prefijo: '/finanzas', roles: ['ADMIN'] }, // dashboard financiero maestro
  { prefijo: '/bi', roles: ['ADMIN'] },
  { prefijo: '/obligaciones', roles: ['ADMIN'] },
  { prefijo: '/documentos', roles: ['ADMIN'] }, // documentos automáticos en Sheets (nuevo)
  { prefijo: '/rimpe', roles: ['ADMIN'] }, // control simple RIMPE sin facturación (nuevo)
  { prefijo: '/proveedores', roles: ['ADMIN', 'OPERACIONES'] }, // módulo ERP extra
  { prefijo: '/integraciones', roles: ['ADMIN'] },
  { prefijo: '/usuarios', roles: ['ADMIN'] }, // gestión de usuarios (módulo ERP extra)
  { prefijo: '/ajustes', roles: ['ADMIN'] },
];

/** Permisos equivalentes para las rutas de API (protección en el middleware). */
export const PERMISOS_API: { prefijo: string; roles: Rol[] }[] = [
  { prefijo: '/api/facturas', roles: ['ADMIN', 'FACTURADOR'] },
  { prefijo: '/api/clientes', roles: ['ADMIN', 'FACTURADOR'] },
  { prefijo: '/api/solicitudes', roles: ['ADMIN', 'FACTURADOR'] },
  { prefijo: '/api/reservas', roles: ['ADMIN', 'FACTURADOR'] },
  { prefijo: '/api/ocupacion', roles: ['ADMIN', 'FACTURADOR'] },
  { prefijo: '/api/caja', roles: ['ADMIN', 'FACTURADOR'] },
  { prefijo: '/api/productos', roles: ['ADMIN', 'FACTURADOR'] },
  { prefijo: '/api/inventario', roles: ['ADMIN', 'OPERACIONES'] },
  { prefijo: '/api/mantenimiento', roles: ['ADMIN', 'OPERACIONES'] },
  { prefijo: '/api/mejoras', roles: ['ADMIN', 'OPERACIONES'] },
  { prefijo: '/api/lavanderia', roles: ['ADMIN', 'OPERACIONES'] },
  { prefijo: '/api/reparaciones', roles: ['ADMIN', 'OPERACIONES'] },
  { prefijo: '/api/compras', roles: ['ADMIN', 'OPERACIONES'] },
  { prefijo: '/api/proveedores', roles: ['ADMIN', 'OPERACIONES'] },
  { prefijo: '/api/contactos', roles: ['ADMIN', 'OPERACIONES'] },
  { prefijo: '/api/gastos', roles: ['ADMIN', 'OPERACIONES'] },
  { prefijo: '/api/estadisticas', roles: ['ADMIN'] },
  { prefijo: '/api/finanzas', roles: ['ADMIN'] },
  { prefijo: '/api/bi', roles: ['ADMIN'] },
  { prefijo: '/api/exportar', roles: ['ADMIN'] },
  { prefijo: '/api/obligaciones', roles: ['ADMIN'] },
  { prefijo: '/api/documentos', roles: ['ADMIN'] },
  { prefijo: '/api/rimpe', roles: ['ADMIN'] },
  { prefijo: '/api/tarifas', roles: ['ADMIN', 'FACTURADOR'] },
  { prefijo: '/api/configuracion', roles: ['ADMIN'] },
  { prefijo: '/api/integraciones', roles: ['ADMIN'] },
  { prefijo: '/api/usuarios', roles: ['ADMIN'] },
];

/** ¿El rol puede acceder a la ruta? ADMIN siempre; rutas no listadas => sí. */
export function puedeAccederRuta(rol: Rol, pathname: string): boolean {
  if (rol === 'ADMIN') return true;
  const regla = [...PERMISOS_RUTA, ...PERMISOS_API].find((r) => pathname.startsWith(r.prefijo));
  if (!regla) return true; // ruta sin restricción explícita
  return regla.roles.includes(rol);
}
