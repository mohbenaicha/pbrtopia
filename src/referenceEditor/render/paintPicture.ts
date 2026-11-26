import type { Rect } from '../model/geometry';
import type { Raster } from '../model/raster';

/** A view of the raster's own bytes as an ImageData (no copy); make a new one whenever the raster object is replaced. */
export const imageDataOf = (raster: Raster): ImageData => new ImageData(raster.bytes as Uint8ClampedArray<ArrayBuffer>, raster.width, raster.height);

/** Copies only the dirty rectangles to the picture canvas. Cost: O(dirty area). */
export function paintPicture(ctx: CanvasRenderingContext2D, image: ImageData, rects: readonly Rect[]): void {
  for (const rect of rects) ctx.putImageData(image, 0, 0, rect.x, rect.y, rect.w, rect.h);
}

/** Runs `work` once on the next animation frame however many times it is asked for. */
export function createFrameScheduler(work: () => void): { request(): void; cancel(): void } {
  let frame = 0;
  return {
    request() {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => { frame = 0; work(); });
    },
    cancel() {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
