// R24: the longest side of a run log preview.
export const PREVIEW_MAX_SIDE = 1024;
const PREVIEW_QUALITY = 0.85;

/** The size an image is shown at in the log: its longer side at most `maxSide`, the proportions kept, never larger than the image, no side below 1. */
export function computePreviewSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * R24: a JPEG of at most `maxSide` px on its longer side, so a log row holds a small picture and not the full result. The image itself comes back
 * when it already fits. It rejects when the browser cannot decode or draw it: its size cannot be limited, so the row gets no preview.
 */
export async function makeImagePreview(image: Blob, maxSide: number = PREVIEW_MAX_SIDE): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  try {
    const size = computePreviewSize(bitmap.width, bitmap.height, maxSide);
    if (size.width === bitmap.width && size.height === bitmap.height) return image;
    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('The browser cannot draw a preview.');
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: PREVIEW_QUALITY });
  } finally {
    bitmap.close();
  }
}
