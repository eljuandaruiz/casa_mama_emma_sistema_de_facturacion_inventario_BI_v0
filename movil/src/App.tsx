import { useEffect, useState } from 'react';
import { Hoy } from './paginas/Hoy';
import { Calendario } from './paginas/Calendario';
import { Gastos } from './paginas/Gastos';
import { Mantenimiento } from './paginas/Mantenimiento';
import { Mas, type SubMas } from './paginas/Mas';
import { IconoBilletera, IconoCalendario, IconoCasa, IconoLlave, IconoMas } from './componentes/Iconos';
import { franjaDelDia } from './lib/tema';

type Pestana = 'hoy' | 'calendario' | 'dinero' | 'trabajos' | 'mas';

const PESTANAS: { id: Pestana; etiqueta: string; Icono: typeof IconoCasa }[] = [
  { id: 'hoy', etiqueta: 'Hoy', Icono: IconoCasa },
  { id: 'calendario', etiqueta: 'Calendario', Icono: IconoCalendario },
  { id: 'dinero', etiqueta: 'Dinero', Icono: IconoBilletera },
  { id: 'trabajos', etiqueta: 'Trabajos', Icono: IconoLlave },
  { id: 'mas', etiqueta: 'Más', Icono: IconoMas },
];

export default function App() {
  const [pestana, setPestana] = useState<Pestana>('hoy');
  const [subMas, setSubMas] = useState<SubMas>(null);

  // Modo oscuro automático de noche, como el sistema de PC.
  useEffect(() => {
    const aplicar = () => document.documentElement.classList.toggle('dark', franjaDelDia() === 'noche');
    aplicar();
    const t = setInterval(aplicar, 60_000);
    return () => clearInterval(t);
  }, []);

  const irA = (p: 'calendario' | 'mas') => {
    if (p === 'mas') setSubMas('obligaciones');
    setPestana(p);
  };

  return (
    <div className="app">
      <div className="contenido">
        {pestana === 'hoy' && <Hoy irA={irA} />}
        {pestana === 'calendario' && <Calendario />}
        {pestana === 'dinero' && <Gastos />}
        {pestana === 'trabajos' && <Mantenimiento />}
        {pestana === 'mas' && <Mas sub={subMas} setSub={setSubMas} />}
      </div>
      <nav className="nav">
        {PESTANAS.map(({ id, etiqueta, Icono }) => (
          <button key={id} className={pestana === id ? 'activo' : ''} onClick={() => { setPestana(id); if (id === 'mas') setSubMas(null); }}>
            <Icono />
            {etiqueta}
          </button>
        ))}
      </nav>
    </div>
  );
}
