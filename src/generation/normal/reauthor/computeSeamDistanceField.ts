// normal-reauthor R6: per texel, the distance to the nearest seam segment. No DOM, no store.
import type { SeamSegment, SeamSegmentPair } from './collectSeamSegments';

function distanceToSegment(px: number, py: number, segment: SeamSegment): number {
  const dx = segment[2] - segment[0];
  const dy = segment[3] - segment[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((px - segment[0]) * dx + (py - segment[1]) * dy) / lengthSquared));
  const offsetX = segment[0] + t * dx - px;
  const offsetY = segment[1] + t * dy - py;
  return Math.sqrt(offsetX * offsetX + offsetY * offsetY); // R9: only + - * / sqrt, so every engine gives the same bytes
}

/** Distance (texels, from the texel centre) to the nearest segment of any pair; +Infinity farther than `reach`. */
export function computeSeamDistanceField(pairs: readonly SeamSegmentPair[], side: number, reach: number): Float32Array {
  const field = new Float32Array(side * side).fill(Number.POSITIVE_INFINITY);
  if (reach <= 0) return field;
  for (const pair of pairs) {
    for (const segment of pair) {
      const [x0, y0, x1, y1] = segment;
      const firstRow = Math.max(0, Math.floor(Math.min(y0, y1) - reach));
      const lastRow = Math.min(side - 1, Math.ceil(Math.max(y0, y1) + reach));
      for (let row = firstRow; row <= lastRow; row += 1) {
        const py = row + 0.5;
        // the part of the segment whose height is within reach of this row bounds the columns worth testing
        const dy = y1 - y0;
        let tLow = 0;
        let tHigh = 1;
        if (Math.abs(dy) > 1e-9) {
          const tA = (py - reach - y0) / dy;
          const tB = (py + reach - y0) / dy;
          tLow = Math.max(0, Math.min(tA, tB));
          tHigh = Math.min(1, Math.max(tA, tB));
          if (tLow > tHigh) continue;
        } else if (Math.abs(py - y0) > reach) continue;
        const xA = x0 + (x1 - x0) * tLow;
        const xB = x0 + (x1 - x0) * tHigh;
        const firstColumn = Math.max(0, Math.floor(Math.min(xA, xB) - reach));
        const lastColumn = Math.min(side - 1, Math.ceil(Math.max(xA, xB) + reach));
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const distance = distanceToSegment(column + 0.5, py, segment);
          if (distance <= reach && distance < field[row * side + column]!) field[row * side + column] = distance;
        }
      }
    }
  }
  return field;
}
