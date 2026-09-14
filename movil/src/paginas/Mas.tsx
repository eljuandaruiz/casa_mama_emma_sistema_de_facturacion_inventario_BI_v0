import { IconoAlerta, IconoCalculadora, IconoCama, IconoGrafico } from '../componentes/Iconos';
import { Reportes } from './Reportes';
import { Simulador } from './Simulador';
import { Obligaciones } from './Obligaciones';
import { Habitaciones } from './Habitaciones';

export type SubMas = 'reportes' | 'simulador' | 'obligaciones' | 'habitaciones' | null;

const OPCIONES: { id: Exclude<SubMas, null>; titulo: string; detalle: string; Icono: typeof IconoGrafico }[] = [
  { id: 'reportes', titulo: 'Reportes y análisis con IA', detalle: 'Totales del periodo, PDF y archivo para ChatGPT/Claude', Icono: IconoGrafico },
  { id: 'obligaciones', titulo: 'Obligaciones tributarias', detalle: 'IVA, renta, patente, permisos y sus vencimientos', Icono: IconoAlerta },
  { id: 'simulador', titulo: 'Simulador de factura', detalle: 'Calcula el total con IVA antes de facturar en la PC', Icono: IconoCalculadora },
  { id: 'habitaciones', titulo: 'Habitaciones y tarifas', detalle: 'Nombres, camas, capacidad y precios', Icono: IconoCama },
];

export function Mas({ sub, setSub }: { sub: SubMas; setSub: (s: SubMas) => void }) {
  if (sub) {
    return (
      <div className="apilado">
        <button className="volver" onClick={() => setSub(null)}>‹ Más</button>
        {sub === 'reportes' && <Reportes />}
        {sub === 'simulador' && <Simulador />}
        {sub === 'obligaciones' && <Obligaciones />}
        {sub === 'habitaciones' && <Habitaciones />}
      </div>
    );
  }
  return (
    <div className="apilado">
      <h1>Más</h1>
      <section className="tarjeta" style={{ padding: '0 4px' }}>
        {OPCIONES.map(({ id, titulo, detalle, Icono }) => (
          <div key={id} className="menu-item" onClick={() => setSub(id)}>
            <span className="icono-menu"><Icono /></span>
            <div>
              <p>{titulo}</p>
              <span>{detalle}</span>
            </div>
          </div>
        ))}
      </section>
      <p className="texto-tenue">Casa Mamá Emma · app local: tus datos viven solo en este teléfono. La facturación electrónica al SRI se hace desde el sistema de la PC.</p>
    </div>
  );
}
