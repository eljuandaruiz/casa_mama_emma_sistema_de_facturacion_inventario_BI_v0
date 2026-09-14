import { comprimirImagen } from './imagen';

/**
 * Elige una foto (cámara o galería) con el selector nativo del navegador/WebView,
 * igual que el sistema web de la PC: es lo más confiable dentro del APK y no
 * depende de permisos extra ni reinicia la pantalla.
 * Devuelve un data URI comprimido, o null si se cancela.
 */
export function tomarFoto(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    let resuelto = false;
    const terminar = (valor: string | null) => {
      if (resuelto) return;
      resuelto = true;
      input.remove();
      resolve(valor);
    };

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return terminar(null);
      try {
        terminar(await comprimirImagen(file, 800, 0.6));
      } catch {
        terminar(null);
      }
    };
    // Si el usuario cancela, algunos WebView no disparan ningún evento: se
    // libera el input al volver el foco a la ventana.
    window.addEventListener('focus', () => setTimeout(() => { if (!input.files?.length) terminar(null); }, 1500), { once: true });

    input.click();
  });
}
