import type { MapKind } from './mapKinds';
import type { PixelImage } from './png/pngCodec';
import { encodePngBlob, encodeResizedPngBlob } from './png/pngOffThread';

/** Maps R27: the host's graphics-card resample of a whole picture to side x side, in the stored form of the map. */
export type GpuResizer = (image: PixelImage, kind: MapKind, side: number) => Promise<PixelImage>;

/**
 * Maps R27, R60: the PNG Blob of a picture as side x side. The graphics card resamples it when the host gave a resizer and the picture is not already
 * that size; with no resizer, or when it fails, the page-side rule does (in a worker for large pictures).
 * Maps R71: `onPixels` gets the S x S pixels before they are encoded, when they exist in the page (the resizer's result, or the picture itself).
 */
export async function resizeToSquareBlob(image: PixelImage, kind: MapKind, side: number, resize?: GpuResizer, onPixels?: (pixels: PixelImage) => void): Promise<Blob> {
  if (image.width === side && image.height === side) {
    onPixels?.(image);
  } else if (resize !== undefined) {
    try {
      const resized = await resize(image, kind, side);
      onPixels?.(resized);
      return await encodePngBlob(resized);
    } catch {
      // the graphics card cannot take this picture: the page-side rule below gives the same kind of result
    }
  }
  return encodeResizedPngBlob(image, side, { normal: kind === 'normal' });
}
