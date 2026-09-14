import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

async function blobADataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

/** Comparte un texto (WhatsApp, correo, etc.). En navegador cae a copiar al portapapeles. */
export async function compartirTexto(titulo: string, texto: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Share.share({ title: titulo, text: texto });
    return;
  }
  if (navigator.share) {
    await navigator.share({ title: titulo, text: texto });
    return;
  }
  await navigator.clipboard.writeText(texto);
  window.alert('Copiado al portapapeles.');
}

/**
 * Comparte un archivo (PDF o texto). Dentro del APK (Android real) usa
 * Filesystem + Share; en un navegador normal usa la Web Share API o,
 * si no está disponible, descarga el archivo.
 */
export async function compartirArchivo(nombre: string, blob: Blob, titulo: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const dataUri = await blobADataUri(blob);
    const base64 = dataUri.split(',')[1];
    const { uri } = await Filesystem.writeFile({ path: nombre, data: base64, directory: Directory.Cache });
    await Share.share({ title: titulo, url: uri });
    return;
  }
  const file = new File([blob], nombre, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    await nav.share({ files: [file], title: titulo });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
