// Exact reference for the coverage rule of reference-editor data-model: pixel (x, y) is covered by the segment a-b when 4 * d^2 <= size^2 (integer arithmetic).
export interface IntPoint { x: number; y: number }

export function isCovered(x: number, y: number, a: IntPoint, b: IntPoint, size: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const dot = (x - a.x) * dx + (y - a.y) * dy;
  if (len2 === 0 || dot <= 0) return 4 * ((x - a.x) ** 2 + (y - a.y) ** 2) <= size * size;
  if (dot >= len2) return 4 * ((x - b.x) ** 2 + (y - b.y) ** 2) <= size * size;
  const cross = (x - a.x) * dy - (y - a.y) * dx;
  return 4 * cross * cross <= size * size * len2;
}

/** The set of covered pixel indexes of one full capsule (both end discs), inside width x height. */
export function coveredSet(a: IntPoint, b: IntPoint, size: number, width: number, height: number): Set<number> {
  const covered = new Set<number>();
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (isCovered(x, y, a, b, size)) covered.add(y * width + x);
  return covered;
}

/** Pixels an incremental segment must write: the full capsule minus the disc at `from` when the segment is not the first of its stroke. */
export function expectedNewPixels(a: IntPoint, b: IntPoint, size: number, width: number, height: number, first: boolean): Set<number> {
  const covered = coveredSet(a, b, size, width, height);
  if (first) return covered;
  for (const index of coveredSet(a, a, size, width, height)) covered.delete(index);
  return covered;
}
