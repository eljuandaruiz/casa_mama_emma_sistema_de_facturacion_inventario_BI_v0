import { useState } from 'react';
import { Inicio } from './paginas/Inicio';
import { Gastos } from './paginas/Gastos';
import { Mantenimiento } from './paginas/Mantenimiento';
import { Reportes } from './paginas/Reportes';
import { Simulador } from './paginas/Simulador';

const PESTANAS = [
  { id: 'inicio', etiqueta: 'Inicio' },
  { id: 'gastos', etiqueta: 'Gastos' },
  { id: 'mantenimiento', etiqueta: 'Trabajos' },
  { id: 'reportes', etiqueta: 'Reportes' },
  { id: 'simulador', etiqueta: 'Simulador' },
] as const;

type Pestana = (typeof PESTANAS)[number]['id'];

export default function App() {
  const [pestana, setPestana] = useState<Pestana>('inicio');

  return (
    <div className="app">
      <header className="encabezado">
        <h1>Casa Mamá Emma</h1>
        <p>App local · tus datos quedan en este teléfono</p>
      </header>
      <div className="contenido">
        {pestana === 'inicio' && <Inicio />}
        {pestana === 'gastos' && <Gastos />}
        {pestana === 'mantenimiento' && <Mantenimiento />}
        {pestana === 'reportes' && <Reportes />}
        {pestana === 'simulador' && <Simulador />}
      </div>
      <nav className="nav">
        {PESTANAS.map((p) => (
          <button key={p.id} className={pestana === p.id ? 'activo' : ''} onClick={() => setPestana(p.id)}>
            {p.etiqueta}
          </button>
        ))}
      </nav>
    </div>
  );
}
