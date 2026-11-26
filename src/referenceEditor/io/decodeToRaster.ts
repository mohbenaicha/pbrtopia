import { rasterFromBuffer, type Raster } from '../model/raster';

/** Longest side the editor works at (architecture D10). */
export const MAX_WORKING_SIDE = 4096;

/** The decode target for a picture of the known size: aspect kept, longest side at most `max`. */
export function workingSize(width: number, height: number, max = MAX_WORKING_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Decodes the picture once, at the working size, and flattens transparency onto white so the working image is always opaque (architecture D1).
 * The size comes from the reference (known up front), so a huge picture is never decoded at full size first.
 */
export async function decodeToRaster(source: Blob, knownWidth: number, knownHeight: number): Promise<Raster> {
  const target = workingSize(knownWidth, knownHeight);
  const resize = target.width !== knownWidth || target.height !== knownHeight;
  const bitmap = await createImageBitmap(source, resize ? { resizeWidth: target.width, resizeHeight: target.height, resizeQuality: 'high' } : undefined);
  try {
    const { width, height } = bitmap;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx === null) throw new Error('no 2d context');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height);
    return rasterFromBuffer(width, height, pixels.data.buffer as ArrayBuffer);
  } finally {
    bitmap.close();
  }
}
