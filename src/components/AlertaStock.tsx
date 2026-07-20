'use client';

/**
 * Banner GLOBAL de reposición: visible en toda la app (para roles con acceso
 * a inventario) cuando algún artículo cae al 25% o menos de su stock. Se puede
 * ocultar temporalmente; reaparece al recargar si el faltante sigue.
 */
import { useEffect, useState } from 'react';

interface ArticuloBajo {
  id: number;
  nombre: string;
  stock: number;
  unidad: string;
}

export function AlertaStock() {
  const [bajos, setBajos] = useState<ArticuloBajo[]>([]);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      fetch('/api/inventario/alertas')
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => { if (vivo) setBajos(Array.isArray(d) ? d : []); })
        .catch(() => {});
    cargar();
    // Refresca cada 5 min (el stock cambia al facturar).
    const t = setInterval(cargar, 5 * 60 * 1000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  if (oculto || bajos.length === 0) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 md:px-8">
      <div className="mx-auto flex max-w-5xl items-center gap-2">
        <span aria-hidden>⚠️</span>
        <p className="flex-1">
          <b>Reponer stock:</b>{' '}
          {bajos.map((a) => `${a.nombre} (${a.stock} ${a.unidad})`).join(' · ')}
        </p>
        <button
          onClick={() => setOculto(true)}
          className="shrink-0 rounded-lg px-2 py-0.5 text-amber-700 hover:bg-amber-100"
          aria-label="Ocultar aviso"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
