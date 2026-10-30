import type { Result } from '../providers/providerTypes';

const SCALED_QUALITY = 0.92;
const KEPT_TYPES = ['image/jpeg', 'image/webp'];

/** Generate R29: the size an image is scaled to so its longest side is `maxPx`, proportions kept, no side below 1; null when it already fits. */
export function computeScaledSize(width: number, height: number, maxPx: number): { width: number; height: number } | null {
  const longest = Math.max(width, height);
  if (longest <= maxPx) return null;
  const scale = maxPx / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Generate R29: the image itself when its longest side is at most `maxPx` (nothing is scaled up or re-encoded), else a copy scaled down
 * with the proportions kept, in the image's own type when that is JPEG or WebP and as PNG otherwise. An error when the browser cannot
 * decode or draw it.
 */
export async function scaleImageToMaxSide(image: Blob, maxPx: number): Promise<Result<Blob, string>> {
  try {
    const bitmap = await createImageBitmap(image);
    try {
      const size = computeScaledSize(bitmap.width, bitmap.height, maxPx);
      if (size === null) return { ok: true, value: image };
      const canvas = new OffscreenCanvas(size.width, size.height);
      const context = canvas.getContext('2d');
      if (context === null) return { ok: false, error: 'The browser cannot draw the scaled image.' };
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      const type = KEPT_TYPES.includes(image.type) ? image.type : 'image/png';
      return { ok: true, value: await canvas.convertToBlob({ type, quality: SCALED_QUALITY }) };
    } finally {
      bitmap.close();
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The image could not be scaled.' };
  }
}
