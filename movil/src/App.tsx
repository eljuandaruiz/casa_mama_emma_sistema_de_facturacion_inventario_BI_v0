import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Hoy } from './paginas/Hoy';
import { Calendario } from './paginas/Calendario';
import { Gastos } from './paginas/Gastos';
import { Mantenimiento } from './paginas/Mantenimiento';
import { Mas } from './paginas/Mas';
import { IconoBilletera, IconoCalendario, IconoCasa, IconoLlave, IconoMas } from './componentes/Iconos';
import { aplicarTema } from './lib/tema';
import { guardarNavegacion, leerNavegacion, type Pestana } from './lib/navegacion';

const PESTANAS: { id: Pestana; etiqueta: string; Icono: typeof IconoCasa }[] = [
  { id: 'hoy', etiqueta: 'Hoy', Icono: IconoCasa },
  { id: 'calendario', etiqueta: 'Calendario', Icono: IconoCalendario },
  { id: 'dinero', etiqueta: 'Dinero', Icono: IconoBilletera },
  { id: 'trabajos', etiqueta: 'Trabajos', Icono: IconoLlave },
  { id: 'mas', etiqueta: 'Más', Icono: IconoMas },
];

export default function App() {
  const inicial = leerNavegacion();
  const [pestana, setPestana] = useState<Pestana>(inicial.pestana);
  const [subMas, setSubMas] = useState<string | null>(inicial.sub);

  // Tema Auto/Claro/Oscuro (Auto = oscuro de noche, como el sistema de PC).
  useEffect(() => {
    aplicarTema();
    const t = setInterval(() => aplicarTema(), 60_000);
    return () => clearInterval(t);
  }, []);

  // Recuerda dónde estabas: Android reinicia la pantalla al elegir fotos o
  // cuando le falta memoria, y antes eso te devolvía siempre al inicio.
  useEffect(() => {
    guardarNavegacion({ pestana, sub: subMas });
  }, [pestana, subMas]);

  // Botón ATRÁS de Android: retrocede dentro de la app en vez de cerrarla.
  useEffect(() => {
    const listener = CapApp.addListener('backButton', () => {
      if (subMas) setSubMas(null);
      else if (pestana !== 'hoy') setPestana('hoy');
      else void CapApp.exitApp();
    });
    return () => {
      void listener.then((l) => l.remove());
    };
  }, [pestana, subMas]);

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
