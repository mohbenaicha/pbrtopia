import type { PixelImage } from '../imageTypes';

const REACH_AT_1024 = 16;
const FAR = 60000;

/** mask-mode R28: how far the gutter is filled, in texels of a picture of this side. */
export function gutterReach(side: number): number {
  return Math.ceil((REACH_AT_1024 * side) / 1024);
}

interface ProbeOffsets {
  dx: Int16Array;
  dy: Int16Array;
  d2: Int32Array;
  startAt: Int32Array; // startAt[c] = first offset whose squared distance is at least c * c
}

/** Offsets within the reach, nearest first; equal distances: lower row, then lower column. */
function buildProbeOffsets(reach: number): ProbeOffsets {
  const found: Array<[number, number, number]> = [];
  for (let dy = -reach; dy <= reach; dy += 1) for (let dx = -reach; dx <= reach; dx += 1) if (dx * dx + dy * dy <= reach * reach) found.push([dx * dx + dy * dy, dy, dx]);
  found.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const offsets: ProbeOffsets = { dx: new Int16Array(found.length), dy: new Int16Array(found.length), d2: new Int32Array(found.length), startAt: new Int32Array(reach + 2) };
  found.forEach(([d2, dy, dx], at) => {
    offsets.d2[at] = d2;
    offsets.dy[at] = dy;
    offsets.dx[at] = dx;
  });
  for (let c = 0; c <= reach + 1; c += 1) {
    let at = 0;
    while (at < found.length && offsets.d2[at]! < c * c) at += 1;
    offsets.startAt[c] = at;
  }
  return offsets;
}

/** Chebyshev distance to the nearest island texel (exact by two chamfer passes); FAR where there is none. A lower bound of the Euclidean distance, so it skips the texels that cannot reach an island. */
function measureSquareDistance(coverage: Uint8Array, side: number): Uint16Array {
  const distance = new Uint16Array(side * side);
  for (let at = 0; at < distance.length; at += 1) distance[at] = coverage[at] === 1 ? 0 : FAR;
  const relax = (at: number, other: number): void => {
    if (distance[other]! + 1 < distance[at]!) distance[at] = distance[other]! + 1;
  };
  for (let row = 0; row < side; row += 1) {
    for (let column = 0; column < side; column += 1) {
      const at = row * side + column;
      if (column > 0) relax(at, at - 1);
      if (row > 0) {
        relax(at, at - side);
        if (column > 0) relax(at, at - side - 1);
        if (column < side - 1) relax(at, at - side + 1);
      }
    }
  }
  for (let row = side - 1; row >= 0; row -= 1) {
    for (let column = side - 1; column >= 0; column -= 1) {
      const at = row * side + column;
      if (column < side - 1) relax(at, at + 1);
      if (row < side - 1) {
        relax(at, at + side);
        if (column < side - 1) relax(at, at + side + 1);
        if (column > 0) relax(at, at + side - 1);
      }
    }
  }
  return distance;
}

/**
 * Mask-bake-session R9, mask-mode R28: for every gutter texel (one `coverage` does not mark as under an island triangle) within `gutterReach` of an island texel, the index of the
 * nearest island texel (Euclidean between texel centres, ties by lower row, then lower column); -1 for an island texel and for a texel with no island within reach. 4n bytes, made once per coverage.
 * The same algorithm as the normal map's outside fill (normal-reauthor R8), kept here so the masks core imports nothing new.
 */
export function computeNearestIslandTexels(coverage: Uint8Array, side: number): Int32Array {
  if (coverage.length !== side * side) throw new RangeError('The coverage must have one byte per texel of the maps.');
  const table = new Int32Array(side * side).fill(-1);
  const reach = gutterReach(side);
  const square = measureSquareDistance(coverage, side);
  const offsets = buildProbeOffsets(reach);
  for (let row = 0; row < side; row += 1) {
    for (let column = 0; column < side; column += 1) {
      const at = row * side + column;
      const near = square[at]!;
      if (near === 0 || near > reach) continue; // an island texel, or no island within reach
      for (let probe = offsets.startAt[near]!; probe < offsets.d2.length; probe += 1) {
        const y = row + offsets.dy[probe]!;
        const x = column + offsets.dx[probe]!;
        if (y < 0 || y >= side || x < 0 || x >= side) continue;
        const source = y * side + x;
        if (coverage[source] !== 1) continue;
        table[at] = source;
        break;
      }
    }
  }
  return table;
}

/** Mask-bake-session R9: new planes in which every gutter texel with a source takes that source's byte (one copy per texel and plane); everything else keeps the plane's byte. The input planes are unchanged. */
export function fillGutterFromTable(planes: readonly PixelImage[], table: Int32Array): PixelImage[] {
  return planes.map((plane) => {
    if (plane.data.length !== table.length) throw new RangeError('The table must have one entry per texel of the maps.');
    const data = new Uint8Array(plane.data);
    for (let at = 0; at < table.length; at += 1) {
      const source = table[at]!;
      if (source >= 0) data[at] = plane.data[source]!;
    }
    return { ...plane, data };
  });
}
