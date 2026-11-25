import { FADE_RANGE, POOL_CELLS_PER_RADIUS, RADII_AT_1024, type SharpnessDeltas, type SmoothedHeight } from './heightTypes';
import { poolExtreme, readCoarse, squareExtreme } from './windowExtremes';

// normal-height-edit R4 (linear form): a pass is `h + p * D`, where D = the mean over the radii of range * fade * (s - u) depends on the pass's input alone. This computes D for
// the smoothed height (d0) and for smoothed + d0 (d1), once per load; a release is then a multiply-add (buildWorkingHeight). Windows only see texels of the same island.

interface IslandBox {
  number: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface WindowFields {
  lo: Float32Array;
  hi: Float32Array;
  width: number;
  height: number;
  block: number;
}

export function prepareSharpness(height: SmoothedHeight): SharpnessDeltas {
  const { smoothed, owner, side } = height;
  const boxes = findIslandBoxes(owner, side);
  const d0 = computeDeltas(smoothed, owner, side, boxes);
  const stepped = new Float32Array(smoothed.length);
  for (let i = 0; i < stepped.length; i += 1) stepped[i] = smoothed[i]! + d0[i]!;
  return { d0, d1: computeDeltas(stepped, owner, side, boxes) };
}

function findIslandBoxes(owner: Uint16Array, side: number): IslandBox[] {
  const boxes = new Map<number, IslandBox>();
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const number = owner[y * side + x]!;
      if (number === 0) continue;
      const box = boxes.get(number);
      if (box === undefined) boxes.set(number, { number, minX: x, minY: y, maxX: x, maxY: y });
      else {
        if (x < box.minX) box.minX = x;
        if (x > box.maxX) box.maxX = x;
        box.maxY = y; // rows come in order
      }
    }
  }
  return [...boxes.values()];
}

function computeDeltas(values: Float32Array, owner: Uint16Array, side: number, boxes: readonly IslandBox[]): Float32Array {
  const out = new Float32Array(side * side);
  for (const box of boxes) writeIslandDeltas(values, owner, side, box, out);
  return out;
}

function writeIslandDeltas(values: Float32Array, owner: Uint16Array, side: number, box: IslandBox, out: Float32Array): void {
  const width = box.maxX - box.minX + 1;
  const height = box.maxY - box.minY + 1;
  const forMin = new Float32Array(width * height);
  const forMax = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (box.minY + y) * side + box.minX + x;
      const mine = owner[at] === box.number;
      forMin[y * width + x] = mine ? values[at]! : Infinity;
      forMax[y * width + x] = mine ? values[at]! : -Infinity;
    }
  }
  const fields = RADII_AT_1024.map((radius) => buildWindowFields(forMin, forMax, width, height, Math.max(1, Math.round((radius * side) / 1024))));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (box.minY + y) * side + box.minX + x;
      if (owner[at] !== box.number) continue;
      const value = values[at]!;
      let sum = 0;
      for (const field of fields) {
        const lo = Math.min(value, readCoarse(field.lo, field.width, field.height, field.block, x, y));
        const hi = Math.max(value, readCoarse(field.hi, field.width, field.height, field.block, x, y));
        const range = hi - lo;
        if (range <= 0) continue;
        const u = (value - lo) / range;
        sum += range * smoothstep(range / FADE_RANGE) * (u * u * (3 - 2 * u) - u);
      }
      out[at] = sum / fields.length;
    }
  }
}

/** The window minimum and maximum of one radius: at full resolution up to POOL_CELLS_PER_RADIUS texels, above that on blocks (the local range is smooth). */
function buildWindowFields(forMin: Float32Array, forMax: Float32Array, width: number, height: number, radius: number): WindowFields {
  const block = Math.max(1, Math.floor(radius / POOL_CELLS_PER_RADIUS));
  if (block === 1) return { lo: squareExtreme(forMin, width, height, radius, false), hi: squareExtreme(forMax, width, height, radius, true), width, height, block };
  const low = poolExtreme(forMin, width, height, block, false);
  const high = poolExtreme(forMax, width, height, block, true);
  const cells = Math.max(1, Math.round(radius / block));
  return { lo: squareExtreme(low.cells, low.width, low.height, cells, false), hi: squareExtreme(high.cells, high.width, high.height, cells, true), width: low.width, height: low.height, block };
}

function smoothstep(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}
