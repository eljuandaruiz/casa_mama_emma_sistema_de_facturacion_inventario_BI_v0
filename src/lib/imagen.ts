/**
 * Redimensiona y comprime una imagen en el navegador a un data URI JPEG,
 * para no guardar fotos enormes en la base de datos. Lado máximo 1000px.
 * (Solo cliente: usa Image/canvas.)
 */
export async function comprimirImagen(file: File, maxLado = 1000, calidad = 0.72): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  let { width, height } = img;
  if (width > height && width > maxLado) {
    height = Math.round((height * maxLado) / width);
    width = maxLado;
  } else if (height > maxLado) {
    width = Math.round((width * maxLado) / height);
    height = maxLado;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl; // sin canvas, devuelve original
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', calidad);
}
