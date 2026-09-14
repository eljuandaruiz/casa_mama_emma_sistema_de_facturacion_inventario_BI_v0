import type { ReactNode } from 'react';
import { IconoAlerta, IconoCalculadora, IconoCama, IconoCasa, IconoGrafico } from '../componentes/Iconos';
import { ModuloCrud } from '../componentes/ModuloCrud';
import { MODULOS, moduloPorId } from '../lib/modulos';
import { Reportes } from './Reportes';
import { Simulador } from './Simulador';
import { Obligaciones } from './Obligaciones';
import { Habitaciones } from './Habitaciones';
import { Negocio } from './Negocio';

export type SubMas = string | null;

interface Entrada {
  id: string;
  titulo: string;
  detalle: string;
  color: string;
  icono?: ReactNode;
}

const modulo = (id: string): Entrada => {
  const m = moduloPorId(id)!;
  return { id, titulo: m.titulo, detalle: m.descripcion, color: m.color, icono: <span style={{ fontWeight: 800, fontSize: 15 }}>{m.titulo.charAt(0)}</span> };
};

// Misma agrupación que el menú lateral del sistema de PC.
const SECCIONES: { titulo: string; entradas: Entrada[] }[] = [
  { titulo: 'Recepción', entradas: [modulo('huespedes'), modulo('productos')] },
  { titulo: 'Operación', entradas: [modulo('tareas'), modulo('reparaciones'), modulo('inventario'), modulo('lavanderia')] },
  {
    titulo: 'Finanzas',
    entradas: [
      modulo('compras'), modulo('proveedores'), modulo('mejoras'), modulo('caja'),
      { id: 'reportes', titulo: 'Reportes y análisis con IA', detalle: 'Totales del periodo, PDF y archivo para ChatGPT/Claude', color: '#0f766e', icono: <IconoGrafico /> },
      { id: 'obligaciones', titulo: 'Obligaciones tributarias', detalle: 'IVA, renta, patente, permisos y vencimientos', color: '#1e3a8a', icono: <IconoAlerta /> },
      { id: 'simulador', titulo: 'Simulador de factura', detalle: 'Calcula el total con IVA antes de facturar en la PC', color: '#b45309', icono: <IconoCalculadora /> },
    ],
  },
  {
    titulo: 'Sistema',
    entradas: [
      { id: 'habitaciones', titulo: 'Habitaciones y tarifas', detalle: 'Nombres, camas, capacidad y precios', color: '#0d9488', icono: <IconoCama /> },
      { id: 'negocio', titulo: 'Negocio y app', detalle: 'Apariencia, ubicación para huéspedes y respaldo de datos', color: '#475569', icono: <IconoCasa /> },
    ],
  },
];

export function Mas({ sub, setSub }: { sub: SubMas; setSub: (s: SubMas) => void }) {
  if (sub) {
    const def = moduloPorId(sub);
    return (
      <div className="apilado">
        <button className="volver" onClick={() => setSub(null)}>‹ Más</button>
        {def && <ModuloCrud def={def} />}
        {sub === 'reportes' && <Reportes />}
        {sub === 'simulador' && <Simulador />}
        {sub === 'obligaciones' && <Obligaciones />}
        {sub === 'habitaciones' && <Habitaciones />}
        {sub === 'negocio' && <Negocio />}
      </div>
    );
  }
  return (
    <div className="apilado">
      <h1>Más</h1>
      {SECCIONES.map((s) => (
        <div key={s.titulo}>
          <p className="texto-tenue" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{s.titulo}</p>
          <section className="tarjeta" style={{ padding: '0 4px' }}>
            {s.entradas.map((e) => (
              <div key={e.id} className="menu-item" onClick={() => setSub(e.id)}>
                <span className="icono-menu" style={{ background: `${e.color}22`, color: e.color }}>{e.icono}</span>
                <div>
                  <p>{e.titulo}</p>
                  <span>{e.detalle}</span>
                </div>
              </div>
            ))}
          </section>
        </div>
      ))}
      <p className="texto-tenue">{MODULOS.length + 5} módulos · tus datos viven solo en este teléfono (haz respaldos en Negocio y app). La facturación electrónica al SRI se emite desde el sistema de la PC.</p>
    </div>
  );
}
