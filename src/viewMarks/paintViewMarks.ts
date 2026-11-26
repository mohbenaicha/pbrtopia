import type { MarkedView } from './markedView';
import { fillBackground, paintViewBackdrop } from './paintBackdrop';
import { paintViewLetter } from './paintViewLetter';

// pixels: RGBA, top-down; alpha 0 means background, anything else model (the render target has no MSAA). Mutated in place and
// opaque everywhere afterwards. Nothing is drawn outside the views.
export function paintViewMarks(
  pixels: Uint8ClampedArray,
  canvas: { width: number; height: number },
  views: readonly MarkedView[],
  options: { background: number; gridStep: number },
): void {
  for (const view of views) paintViewBackdrop(pixels, canvas.width, view, options);
  fillBackground(pixels, options.background);
  for (const view of views) paintViewLetter(pixels, canvas, view);
}
