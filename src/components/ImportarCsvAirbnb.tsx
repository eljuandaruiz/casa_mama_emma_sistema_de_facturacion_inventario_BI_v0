'use client';

/**
 * Botón de importación del CSV de reservaciones de Airbnb (menú
 * Reservaciones → Exportar en Airbnb). Complementa el iCal: el CSV sí trae
 * nombre del huésped, nº de huéspedes y payout.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ImportarCsvAirbnb() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const importar = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    setMensaje('');
    setCargando(true);
    try {
      const contenido = await files[0].text();
      const res = await fetch('/api/reservas/importar-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo importar');
      setMensaje(`✅ ${json.creadas} nueva(s), ${json.actualizadas} actualizada(s), ${json.canceladas} cancelada(s) liberada(s).`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="text-right">
      <label className="btn-secundario inline-block cursor-pointer text-sm">
        {cargando ? 'Importando…' : '⬆️ Importar CSV de Airbnb'}
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          disabled={cargando}
          onChange={(e) => importar(e.target.files)}
        />
      </label>
      {mensaje && <p className="mt-1 text-xs text-emerald-700">{mensaje}</p>}
      {error && <p className="mt-1 text-xs text-coral-600">{error}</p>}
    </div>
  );
}
