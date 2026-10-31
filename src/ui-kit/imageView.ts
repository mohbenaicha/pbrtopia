const MIN_ZOOM = 1;
const MAX_ZOOM = 16;
const WHEEL_ZOOM_RATE = 0.0015; // natural-log zoom per wheel delta unit: one 100-unit notch is about 16 %
const WHEEL_LINE_UNITS = 16; // a wheel that reports lines instead of pixels

export interface PixelSize {
  width: number;
  height: number;
}

// Where the picture sits in its frame: the zoom (1 is the picture fitted inside the frame) and how far its centre is from the frame's centre, in frame pixels.
export interface ImageView {
  zoom: number;
  x: number;
  y: number;
}

export const FITTED_IMAGE_VIEW: ImageView = { zoom: 1, x: 0, y: 0 };

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value)) || 0; // `|| 0` keeps a negative zero out of the view

/** The picture drawn as large as the frame allows without cropping it or changing its shape (a small picture is scaled up). */
export function fitImage(image: PixelSize, frame: PixelSize): PixelSize {
  if (image.width <= 0 || image.height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(frame.width / image.width, frame.height / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

// A picture can be moved along a side only while it is longer than the frame on that side.
function limitPan(view: ImageView, image: PixelSize, frame: PixelSize): ImageView {
  const fitted = fitImage(image, frame);
  const reachX = Math.max(0, (fitted.width * view.zoom - frame.width) / 2);
  const reachY = Math.max(0, (fitted.height * view.zoom - frame.height) / 2);
  return { zoom: view.zoom, x: clamp(view.x, -reachX, reachX), y: clamp(view.y, -reachY, reachY) };
}

/** The view after a wheel turn: the picture point under the pointer (given from the frame's centre) stays under it. Unchanged at the zoom limits. */
export function zoomImageAt(view: ImageView, wheelDelta: number, deltaMode: number, pointer: { x: number; y: number }, image: PixelSize, frame: PixelSize): ImageView {
  const delta = deltaMode === 1 ? wheelDelta * WHEEL_LINE_UNITS : wheelDelta;
  const zoom = clamp(view.zoom * Math.exp(-delta * WHEEL_ZOOM_RATE), MIN_ZOOM, MAX_ZOOM);
  if (zoom === view.zoom) return view;
  const ratio = zoom / view.zoom;
  return limitPan({ zoom, x: pointer.x - (pointer.x - view.x) * ratio, y: pointer.y - (pointer.y - view.y) * ratio }, image, frame);
}

/** The view after a drag: the picture follows the pointer from where the drag began. */
export function panImageBy(start: ImageView, dx: number, dy: number, image: PixelSize, frame: PixelSize): ImageView {
  return limitPan({ zoom: start.zoom, x: start.x + dx, y: start.y + dy }, image, frame);
}
