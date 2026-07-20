/**
 * Tema visual por ROL — indicador inequívoco del alcance de permisos del
 * usuario activo. Se muestra como un "pill" y una barra superior de color, de
 * modo que el usuario sabe al instante con qué rol está operando.
 *
 *   ADMIN       -> rojo/oscuro (control total)
 *   FACTURADOR  -> azul (facturación)
 *   OPERACIONES -> verde (operación física)
 */
import type { Rol } from './roles';

export interface TemaRol {
  etiqueta: string;
  color: string; // color de acento (barra/pill)
  textoSobreColor: string; // texto legible encima del color
}

export const TEMA_ROL: Record<Rol, TemaRol> = {
  ADMIN: { etiqueta: 'Administrador', color: '#b91c1c', textoSobreColor: '#ffffff' },
  FACTURADOR: { etiqueta: 'Facturador', color: '#1d4ed8', textoSobreColor: '#ffffff' },
  OPERACIONES: { etiqueta: 'Operaciones', color: '#15803d', textoSobreColor: '#ffffff' },
};

export function temaDeRol(rol: Rol): TemaRol {
  return TEMA_ROL[rol] ?? TEMA_ROL.FACTURADOR;
}
