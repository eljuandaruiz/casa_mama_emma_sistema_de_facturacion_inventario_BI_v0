import { AREAS, CATEGORIAS_GASTO } from './db';

export type TipoCampo = 'texto' | 'textoLargo' | 'numero' | 'dinero' | 'fecha' | 'select' | 'foto' | 'telefono' | 'si_no';

export interface Campo {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: string[];
  requerido?: boolean;
}

export type Datos = Record<string, unknown>;

export interface DefinicionModulo {
  id: string;
  titulo: string;
  singular: string;
  descripcion: string;
  color: string;
  campos: Campo[];
  resumen: (d: Datos) => { titulo: string; detalle: string; monto?: number; alerta?: string };
}

const t = (d: Datos, k: string) => String(d[k] ?? '');
const n = (d: Datos, k: string) => Number(d[k] ?? 0) || 0;

export const MODULOS: DefinicionModulo[] = [
  {
    id: 'huespedes', titulo: 'Huéspedes', singular: 'huésped', descripcion: 'Clientes con cédula, teléfono y nacionalidad', color: '#0d9488',
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre completo', tipo: 'texto', requerido: true },
      { clave: 'tipoId', etiqueta: 'Tipo de identificación', tipo: 'select', opciones: ['Cédula', 'RUC', 'Pasaporte', 'Consumidor final'] },
      { clave: 'identificacion', etiqueta: 'Número de identificación', tipo: 'texto' },
      { clave: 'telefono', etiqueta: 'Teléfono', tipo: 'telefono' },
      { clave: 'email', etiqueta: 'Correo', tipo: 'texto' },
      { clave: 'nacionalidad', etiqueta: 'Nacionalidad', tipo: 'texto' },
      { clave: 'notas', etiqueta: 'Notas', tipo: 'textoLargo' },
    ],
    resumen: (d) => ({ titulo: t(d, 'nombre'), detalle: [t(d, 'tipoId'), t(d, 'identificacion'), t(d, 'nacionalidad')].filter(Boolean).join(' · ') }),
  },
  {
    id: 'proveedores', titulo: 'Proveedores', singular: 'proveedor', descripcion: 'Contactos de compras y servicios', color: '#7c3aed',
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      { clave: 'rubro', etiqueta: 'Rubro u oficio', tipo: 'texto' },
      { clave: 'telefono', etiqueta: 'Teléfono', tipo: 'telefono' },
      { clave: 'ruc', etiqueta: 'RUC', tipo: 'texto' },
      { clave: 'notas', etiqueta: 'Notas', tipo: 'textoLargo' },
    ],
    resumen: (d) => ({ titulo: t(d, 'nombre'), detalle: [t(d, 'rubro'), t(d, 'ruc')].filter(Boolean).join(' · ') }),
  },
  {
    id: 'inventario', titulo: 'Inventario', singular: 'artículo', descripcion: 'Artículos, stock y alertas de reposición', color: '#2563eb',
    campos: [
      { clave: 'nombre', etiqueta: 'Artículo', tipo: 'texto', requerido: true },
      { clave: 'categoria', etiqueta: 'Categoría', tipo: 'select', opciones: CATEGORIAS_GASTO },
      { clave: 'stock', etiqueta: 'Stock actual', tipo: 'numero' },
      { clave: 'minimo', etiqueta: 'Stock mínimo (aviso)', tipo: 'numero' },
      { clave: 'valorUnitario', etiqueta: 'Valor unitario', tipo: 'dinero' },
      { clave: 'foto', etiqueta: 'Foto', tipo: 'foto' },
    ],
    resumen: (d) => ({ titulo: t(d, 'nombre'), detalle: `Stock ${n(d, 'stock')} · mínimo ${n(d, 'minimo')} · ${t(d, 'categoria')}`, alerta: n(d, 'stock') <= n(d, 'minimo') ? 'Reponer' : undefined }),
  },
  {
    id: 'compras', titulo: 'Compras', singular: 'compra', descripcion: 'Activos y consumibles con factura y foto', color: '#ea580c',
    campos: [
      { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', requerido: true },
      { clave: 'categoria', etiqueta: 'Categoría', tipo: 'select', opciones: ['Muebles y electrodomésticos', 'Equipos', 'Lencería', 'Consumibles', 'Herramientas', 'Mejora de inmueble', 'Otros'] },
      { clave: 'area', etiqueta: 'Área', tipo: 'select', opciones: AREAS },
      { clave: 'costo', etiqueta: 'Costo unitario', tipo: 'dinero', requerido: true },
      { clave: 'cantidad', etiqueta: 'Cantidad', tipo: 'numero' },
      { clave: 'proveedor', etiqueta: 'Proveedor', tipo: 'texto' },
      { clave: 'numeroFactura', etiqueta: 'Nº de factura', tipo: 'texto' },
      { clave: 'foto', etiqueta: 'Foto del comprobante', tipo: 'foto' },
    ],
    resumen: (d) => ({ titulo: t(d, 'descripcion'), detalle: `${t(d, 'fecha')} · ${t(d, 'categoria')} · ${t(d, 'area')}`, monto: n(d, 'costo') * (n(d, 'cantidad') || 1) }),
  },
  {
    id: 'mejoras', titulo: 'Mejoras', singular: 'mejora', descripcion: 'Inversiones por área con foto', color: '#0891b2',
    campos: [
      { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { clave: 'area', etiqueta: 'Área', tipo: 'select', opciones: AREAS },
      { clave: 'descripcion', etiqueta: 'Mejora', tipo: 'texto', requerido: true },
      { clave: 'costo', etiqueta: 'Costo', tipo: 'dinero' },
      { clave: 'numeroFactura', etiqueta: 'Nº de factura', tipo: 'texto' },
      { clave: 'foto', etiqueta: 'Foto', tipo: 'foto' },
    ],
    resumen: (d) => ({ titulo: t(d, 'descripcion'), detalle: `${t(d, 'fecha')} · ${t(d, 'area')}`, monto: n(d, 'costo') }),
  },
  {
    id: 'tareas', titulo: 'Tareas', singular: 'tarea', descripcion: 'Pendientes del día a día', color: '#16a34a',
    campos: [
      { clave: 'titulo', etiqueta: 'Tarea', tipo: 'texto', requerido: true },
      { clave: 'area', etiqueta: 'Área', tipo: 'select', opciones: AREAS },
      { clave: 'prioridad', etiqueta: 'Prioridad', tipo: 'select', opciones: ['Urgente', 'Normal', 'Después'] },
      { clave: 'fechaLimite', etiqueta: 'Fecha límite', tipo: 'fecha' },
      { clave: 'hecha', etiqueta: 'Hecha', tipo: 'si_no' },
    ],
    resumen: (d) => ({ titulo: t(d, 'titulo'), detalle: `${t(d, 'prioridad')} · ${t(d, 'area')} · límite ${t(d, 'fechaLimite') || '-'}`, alerta: d.hecha ? undefined : t(d, 'prioridad') === 'Urgente' ? 'Urgente' : undefined }),
  },
  {
    id: 'reparaciones', titulo: 'Reparaciones', singular: 'reparación', descripcion: 'Solicitudes de arreglo con foto y urgencia', color: '#dc2626',
    campos: [
      { clave: 'titulo', etiqueta: 'Qué hay que reparar', tipo: 'texto', requerido: true },
      { clave: 'area', etiqueta: 'Área', tipo: 'select', opciones: AREAS },
      { clave: 'urgencia', etiqueta: 'Urgencia', tipo: 'select', opciones: ['Urgente e importante', 'Importante', 'Urgente', 'Puede esperar'] },
      { clave: 'fechaLimite', etiqueta: 'Fecha límite', tipo: 'fecha' },
      { clave: 'descripcion', etiqueta: 'Detalle', tipo: 'textoLargo' },
      { clave: 'foto', etiqueta: 'Foto del daño', tipo: 'foto' },
      { clave: 'resuelta', etiqueta: 'Resuelta', tipo: 'si_no' },
    ],
    resumen: (d) => ({ titulo: t(d, 'titulo'), detalle: `${t(d, 'urgencia')} · ${t(d, 'area')}`, alerta: d.resuelta ? undefined : 'Pendiente' }),
  },
  {
    id: 'lavanderia', titulo: 'Lavandería', singular: 'ciclo', descripcion: 'Ciclos de lavado y su costo', color: '#0284c7',
    campos: [
      { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { clave: 'piezas', etiqueta: 'Piezas (sábanas, toallas…)', tipo: 'numero' },
      { clave: 'costo', etiqueta: 'Costo', tipo: 'dinero' },
      { clave: 'notas', etiqueta: 'Notas', tipo: 'texto' },
    ],
    resumen: (d) => ({ titulo: `${n(d, 'piezas')} pieza(s)`, detalle: `${t(d, 'fecha')} ${t(d, 'notas')}`, monto: n(d, 'costo') }),
  },
  {
    id: 'productos', titulo: 'Productos y extras', singular: 'producto', descripcion: 'Bebidas, snacks y servicios que se cobran aparte', color: '#d97706',
    campos: [
      { clave: 'nombre', etiqueta: 'Producto', tipo: 'texto', requerido: true },
      { clave: 'precio', etiqueta: 'Precio de venta', tipo: 'dinero', requerido: true },
      { clave: 'stock', etiqueta: 'Stock', tipo: 'numero' },
    ],
    resumen: (d) => ({ titulo: t(d, 'nombre'), detalle: `Stock ${n(d, 'stock')}`, monto: n(d, 'precio') }),
  },
  {
    id: 'caja', titulo: 'Cierres de caja', singular: 'cierre', descripcion: 'Conteo de efectivo por turno', color: '#4f46e5',
    campos: [
      { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { clave: 'usuario', etiqueta: 'Quién cierra', tipo: 'texto' },
      { clave: 'esperado', etiqueta: 'Efectivo esperado', tipo: 'dinero' },
      { clave: 'contado', etiqueta: 'Efectivo contado', tipo: 'dinero', requerido: true },
      { clave: 'notas', etiqueta: 'Notas', tipo: 'texto' },
    ],
    resumen: (d) => {
      const dif = n(d, 'contado') - n(d, 'esperado');
      return { titulo: `${t(d, 'fecha')} · ${t(d, 'usuario') || 'sin nombre'}`, detalle: `Esperado ${n(d, 'esperado').toFixed(2)} · contado ${n(d, 'contado').toFixed(2)}`, monto: n(d, 'contado'), alerta: dif < 0 ? `Falta ${Math.abs(dif).toFixed(2)}` : undefined };
    },
  },
];

export const moduloPorId = (id: string) => MODULOS.find((m) => m.id === id);

/** Monto de un registro (para reportes): compras = costo × cantidad; mejoras/lavandería = costo. */
export function montoRegistro(modulo: string, d: Datos): number {
  if (modulo === 'compras') return n(d, 'costo') * (n(d, 'cantidad') || 1);
  if (modulo === 'mejoras' || modulo === 'lavanderia') return n(d, 'costo');
  return 0;
}
