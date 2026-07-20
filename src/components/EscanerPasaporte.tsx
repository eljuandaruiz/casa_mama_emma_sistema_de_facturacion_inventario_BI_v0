'use client';

/**
 * Escáner de pasaporte por OCR de la zona MRZ. El usuario toma/sube una foto
 * del pasaporte; tesseract.js (cargado BAJO DEMANDA para no inflar el bundle)
 * extrae el texto, y parseMrz interpreta las 2 líneas MRZ → nombre, número y
 * país. Los datos se devuelven al formulario vía onDatos.
 *
 * Degradación: si el OCR falla o la foto no tiene MRZ legible, avisa y el
 * usuario continúa con entrada manual (que siempre está disponible).
 */
import { useState } from 'react';
import { parseMrz, type DatosMrz } from '@/lib/mrz';

export function EscanerPasaporte({ onDatos }: { onDatos: (d: DatosMrz) => void }) {
  const [estado, setEstado] = useState<'idle' | 'procesando' | 'ok' | 'error'>('idle');
  const [progreso, setProgreso] = useState(0);
  const [mensaje, setMensaje] = useState('');

  const escanear = async (file: File | null) => {
    if (!file) return;
    setEstado('procesando');
    setProgreso(0);
    setMensaje('Leyendo el pasaporte…');
    try {
      // Carga dinámica: tesseract.js solo se descarga cuando se usa el escáner.
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(file, 'eng', {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgreso(Math.round(m.progress * 100));
        },
      });
      const datos = parseMrz(data.text);
      if (!datos) {
        setEstado('error');
        setMensaje('No se pudo leer la zona MRZ. Usa la entrada manual.');
        return;
      }
      setEstado('ok');
      setMensaje(`Leído: ${datos.nombreCompleto ?? ''} (${datos.pais ?? '—'})`);
      onDatos(datos);
    } catch {
      setEstado('error');
      setMensaje('Error al procesar la imagen. Usa la entrada manual.');
    }
  };

  return (
    <div className="rounded-xl border border-sri-blue/30 bg-sri-light/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-sri-blue">📷 Escanear pasaporte (MRZ)</p>
          <p className="text-[11px] text-slate-500">Toma una foto nítida de la página de datos.</p>
        </div>
        <label className="btn-secundario cursor-pointer text-sm">
          {estado === 'procesando' ? `${progreso}%` : 'Tomar foto'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={estado === 'procesando'}
            onChange={(e) => escanear(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {mensaje && (
        <p className={`mt-2 text-xs ${estado === 'error' ? 'text-coral-600' : estado === 'ok' ? 'text-emerald-700' : 'text-slate-500'}`}>
          {mensaje}
        </p>
      )}
    </div>
  );
}
