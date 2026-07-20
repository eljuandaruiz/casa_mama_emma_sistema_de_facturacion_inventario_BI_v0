'use client';

/**
 * CONTROL DE TEMA (claro/oscuro).
 *  · Modo AUTO (por defecto): oscuro de noche (20:00–05:59), claro de día.
 *    Reevalúa cada minuto, así "en la noche" toda la app cambia sola.
 *  · El usuario puede forzar Claro u Oscuro con el botón flotante; la
 *    preferencia se recuerda en este dispositivo (localStorage).
 * Aplica/quita la clase `dark` en <html>, que dispara la capa de modo
 * oscuro de globals.css sobre todos los módulos y cajas anidadas.
 */
import { useEffect, useState } from 'react';
import { franjaDelDia } from '@/lib/tema';

type Modo = 'auto' | 'claro' | 'oscuro';
const CLAVE = 'cme_tema';

function esOscuro(modo: Modo): boolean {
  if (modo === 'oscuro') return true;
  if (modo === 'claro') return false;
  return franjaDelDia() === 'noche'; // auto
}

export function ControlTema() {
  const [modo, setModo] = useState<Modo>('auto');

  // Cargar preferencia guardada.
  useEffect(() => {
    const guardado = (localStorage.getItem(CLAVE) as Modo) || 'auto';
    setModo(guardado);
  }, []);

  // Aplicar tema + reevaluar cada minuto (para el cambio automático de noche).
  useEffect(() => {
    const aplicar = () => {
      document.documentElement.classList.toggle('dark', esOscuro(modo));
    };
    aplicar();
    localStorage.setItem(CLAVE, modo);
    const t = setInterval(aplicar, 60 * 1000);
    return () => clearInterval(t);
  }, [modo]);

  const siguiente: Record<Modo, Modo> = { auto: 'claro', claro: 'oscuro', oscuro: 'auto' };
  const etiqueta: Record<Modo, string> = { auto: '🌗 Auto', claro: '☀️ Claro', oscuro: '🌙 Oscuro' };

  return (
    <button
      onClick={() => setModo((m) => siguiente[m])}
      className="fixed right-3 top-3 z-50 rounded-full border border-slate-300 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-md backdrop-blur transition hover:bg-white"
      style={{ minHeight: 'auto' }}
      title="Cambiar tema (Auto / Claro / Oscuro)"
      aria-label="Cambiar tema"
    >
      {etiqueta[modo]}
    </button>
  );
}
