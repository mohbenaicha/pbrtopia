/** One rectangle of a map: x1 and y1 exclusive, `bytes` the rectangle's rows packed (width x height). */
export interface MapRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  bytes: Uint8Array;
}

/** Mask-bake-session R6: a changed map as the session answers it: the whole map, or only the rectangles a region bake touched. */
export type MapResult = { kind: 'whole'; bytes: Uint8Array } | { kind: 'rects'; rects: MapRect[] };

/** Mask-bake-session R6: the new map from the previous one and the answer. The previous map is never changed (the saver and the viewport may still hold it). */
export function applyMapResult(previous: Uint8Array, side: number, result: MapResult): Uint8Array {
  if (result.kind === 'whole') return result.bytes;
  const next = previous.slice();
  for (const { x0, y0, x1, y1, bytes } of result.rects) {
    const width = x1 - x0;
    for (let y = y0; y < y1; y += 1) next.set(bytes.subarray((y - y0) * width, (y - y0 + 1) * width), y * side + x0);
  }
  return next;
}
