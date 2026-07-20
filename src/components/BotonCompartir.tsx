'use client';

/**
 * Botón "Compartir" que usa la HTML5 Web Share API para enviar el PDF
 * directamente por WhatsApp, email, etc. desde el móvil (iPhone/Android).
 *
 * - Descarga el PDF de `url` como blob y arma un File con el NOMBRE DINÁMICO
 *   que envía el servidor en Content-Disposition (o el `nombreSugerido`).
 * - Si el dispositivo no soporta compartir archivos (p. ej. escritorio),
 *   cae elegantemente a abrir el PDF en una pestaña nueva.
 */
import { useState } from 'react';

/** Extrae el filename del header Content-Disposition. */
function nombreDesdeHeader(cd: string | null, fallback: string): string {
  if (!cd) return fallback;
  const m = /filename="?([^"]+)"?/.exec(cd);
  return m?.[1] ?? fallback;
}

export function BotonCompartir({
  url,
  nombreSugerido = 'documento.pdf',
  titulo = 'Casa Mamá Emma',
  className = 'btn-secundario',
}: {
  url: string;
  nombreSugerido?: string;
  titulo?: string;
  className?: string;
}) {
  const [ocupado, setOcupado] = useState(false);

  const compartir = async () => {
    setOcupado(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const nombre = nombreDesdeHeader(res.headers.get('Content-Disposition'), nombreSugerido);
      const file = new File([blob], nombre, { type: 'application/pdf' });

      // navigator.canShare comprueba soporte de compartir ARCHIVOS.
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: titulo, text: titulo });
      } else {
        // Fallback: abrir el PDF (el usuario lo comparte manualmente).
        window.open(url, '_blank');
      }
    } catch {
      // Cancelar el diálogo de compartir no es un error real.
    } finally {
      setOcupado(false);
    }
  };

  return (
    <button onClick={compartir} disabled={ocupado} className={className}>
      {ocupado ? 'Preparando…' : '📤 Compartir'}
    </button>
  );
}
