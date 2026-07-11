// Compresión de fotos de alumno antes de guardarlas en localStorage.
//
// localStorage tiene una cuota chica (~5 MB) y guardamos las fotos como data URL
// dentro del JSON, así que conviene redimensionar y recomprimir cada imagen para
// que ocupe poco. Se hace en el navegador con un <canvas>, sin dependencias.

/** Lee un File como data URL. */
function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Carga una data URL en un HTMLImageElement. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = src;
  });
}

/**
 * Convierte una foto elegida por el usuario en una data URL JPEG chica.
 * Redimensiona para que el lado más largo no supere `maxSize` px y aplica
 * compresión `quality` (0..1). Ideal para fotos de perfil.
 */
export async function fileToCompressedDataURL(
  file: File,
  maxSize = 512,
  quality = 0.72
): Promise<string> {
  const original = await readAsDataURL(file);
  const img = await loadImage(original);

  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original; // Sin canvas, guardamos la original tal cual.
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}
