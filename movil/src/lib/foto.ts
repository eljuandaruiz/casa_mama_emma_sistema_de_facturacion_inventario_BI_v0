import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { comprimirImagen } from './imagen';

/** Toma una foto con la cámara o la elige de la galería (en Android pide permiso la primera vez). */
export async function tomarFoto(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const foto = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        quality: 60,
        width: 1000,
        promptLabelHeader: 'Foto',
        promptLabelPhoto: 'Elegir de la galería',
        promptLabelPicture: 'Tomar foto',
        promptLabelCancel: 'Cancelar',
      });
      return foto.dataUrl ?? null;
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await comprimirImagen(file, 1000, 0.7) : null);
    };
    input.click();
  });
}
