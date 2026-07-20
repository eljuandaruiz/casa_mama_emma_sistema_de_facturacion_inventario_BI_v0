'use client';

/**
 * SELECTOR DE HABITACIONES (vista principal de facturación).
 *
 * Reglas del negocio:
 *  - La habitación 3 y la 4 son UN SOLO espacio físico: se muestran FUSIONADAS
 *    en un único bloque etiquetado "Habitación 3 y 4" (no se pueden separar).
 *  - La grilla resultante es: [Hab 2] [Hab 3 y 4] [Hab 5] [Hab 6] [Hab 7].
 *  - Se pueden marcar varios bloques para una sola factura (p. ej. 2 + 7).
 *  - "Casa completa" factura toda la propiedad en un ítem único.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtUsd } from '@/lib/money';

export interface HabDashboard {
  id: number;
  numero: number;
  nombre: string;
  descripcionCamas: string;
  capacidad: number;
  precioHabitacion: number;
  precioPersona: number;
  grupoCompartido: string | null;
}

// Números de habitación que comparten espacio físico (se fusionan en un bloque).
const ESPACIO_UNICO = [3, 4];

/** Un "bloque" es una tarjeta seleccionable: una habitación normal, o el
 *  espacio fusionado 3+4 (que contiene 2 números de habitación). */
interface Bloque {
  clave: string; // id estable para React
  etiqueta: string; // "Habitación 2" | "Habitación 3 y 4"
  numeros: number[]; // [2] o [3,4]
  capacidad: number;
  precioHabitacion: number;
  descripcion: string;
  esFusion: boolean;
}

export function SelectorHabitaciones({ habitaciones }: { habitaciones: HabDashboard[] }) {
  const router = useRouter();
  // Estado: números de habitación seleccionados (para 3+4 se marcan ambos).
  const [sel, setSel] = useState<number[]>([]);

  // ---- Construye los bloques fusionando 3+4 en uno solo ----
  const bloques = useMemo<Bloque[]>(() => {
    const resultado: Bloque[] = [];
    const fusionables = habitaciones.filter((h) => ESPACIO_UNICO.includes(h.numero));
    const yaAgregadaFusion = { valor: false };

    for (const h of habitaciones) {
      if (ESPACIO_UNICO.includes(h.numero)) {
        // Solo agregamos UNA vez el bloque fusionado (cuando aparece la primera).
        if (yaAgregadaFusion.valor) continue;
        yaAgregadaFusion.valor = true;
        resultado.push({
          clave: 'fusion-3-4',
          etiqueta: 'Habitación 3 y 4',
          numeros: fusionables.map((f) => f.numero).sort((a, b) => a - b),
          capacidad: fusionables.reduce((a, f) => a + f.capacidad, 0),
          // Precio del bloque fusionado = suma de las dos tarifas por habitación.
          precioHabitacion: fusionables.reduce((a, f) => a + f.precioHabitacion, 0),
          descripcion: 'Espacio compartido (un solo ambiente)',
          esFusion: true,
        });
      } else {
        resultado.push({
          clave: `hab-${h.numero}`,
          etiqueta: h.nombre,
          numeros: [h.numero],
          capacidad: h.capacidad,
          precioHabitacion: h.precioHabitacion,
          descripcion: h.descripcionCamas,
          esFusion: false,
        });
      }
    }
    return resultado;
  }, [habitaciones]);

  /** Marca/desmarca un bloque completo (todos sus números a la vez). */
  const toggleBloque = (b: Bloque) => {
    setSel((prev) => {
      const yaEsta = b.numeros.every((n) => prev.includes(n));
      if (yaEsta) return prev.filter((n) => !b.numeros.includes(n));
      return [...new Set([...prev, ...b.numeros])];
    });
  };

  const numsSeleccionados = useMemo(() => [...sel].sort((a, b) => a - b), [sel]);
  const capacidadSel = habitaciones
    .filter((h) => sel.includes(h.numero))
    .reduce((a, h) => a + h.capacidad, 0);

  const irAFacturar = (extra?: { casaCompleta?: boolean }) => {
    const params = new URLSearchParams();
    if (extra?.casaCompleta) params.set('casa', '1');
    else params.set('habs', numsSeleccionados.join(','));
    router.push(`/facturar/grupos?${params.toString()}`);
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Selecciona habitaciones a facturar</h2>
        {sel.length > 0 && (
          <button onClick={() => setSel([])} className="text-xs text-slate-500 underline">
            Limpiar
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {bloques.map((b) => {
          // Un bloque está marcado si TODOS sus números están seleccionados.
          const marcada = b.numeros.every((n) => sel.includes(n));
          return (
            <button
              key={b.clave}
              onClick={() => toggleBloque(b)}
              className={`tarjeta group p-4 text-left transition md:p-5 ${
                marcada ? 'ring-2 ring-brand-500' : 'hover:shadow-cardHover'
              }`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl px-2 text-lg font-bold ${
                    marcada ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700'
                  }`}
                >
                  {b.esFusion ? '3·4' : b.numeros[0]}
                </span>
                {b.esFusion && (
                  <span className="rounded-full bg-sri-light px-2 py-1 text-[10px] font-semibold text-sri-blue">
                    Fusionada
                  </span>
                )}
              </div>
              <p className="mt-3 font-semibold">{b.etiqueta}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{b.descripcion}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">👥 {b.capacidad}</span>
                <span className="font-semibold text-brand-700">{fmtUsd(b.precioHabitacion)}/noche</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ---------- Botón Casa completa ---------- */}
      <button
        onClick={() => irAFacturar({ casaCompleta: true })}
        className="tarjeta mt-3 flex w-full items-center justify-between p-4 transition hover:shadow-cardHover"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sri-light text-lg">🏠</span>
          <span className="text-left">
            <span className="block font-semibold">Casa completa</span>
            <span className="block text-xs text-slate-500">Toda la propiedad · todas las habitaciones</span>
          </span>
        </span>
        <span className="text-brand-700">→</span>
      </button>

      {/* ---------- Barra de acción de la selección (sticky) ---------- */}
      {sel.length > 0 && (
        <div className="sticky bottom-20 z-30 mt-4 md:bottom-4">
          <div className="tarjeta flex items-center justify-between p-4 shadow-cardHover">
            <div className="text-sm">
              <p className="font-semibold">Habitaciones {numsSeleccionados.join(', ')}</p>
              <p className="text-xs text-slate-500">Capacidad total {capacidadSel} personas</p>
            </div>
            <button onClick={() => irAFacturar()} className="btn-primario">
              Facturar selección →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
