// normal-reauthor R8: texels under no island copy their nearest island texel within the reach, else become flat. No DOM, no store.

const FLAT: readonly number[] = [128, 128, 255, 255];
const FAR = 60000;

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

/** Chebyshev distance to the nearest covered texel (exact by two chamfer passes); FAR where there is none. */
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

/** Changes `rgba` (side * side * 4) in place; covered texels are never touched. */
export function fillOutsideIslands(rgba: Uint8ClampedArray, coverage: Uint8Array, side: number, reach: number): void {
  const square = measureSquareDistance(coverage, side);
  const offsets = buildProbeOffsets(Math.max(0, Math.floor(reach)));
  for (let row = 0; row < side; row += 1) {
    for (let column = 0; column < side; column += 1) {
      const at = row * side + column;
      if (coverage[at] === 1) continue;
      let source = -1;
      const near = square[at]!;
      if (near <= reach) {
        for (let probe = offsets.startAt[near]!; probe < offsets.d2.length; probe += 1) {
          const y = row + offsets.dy[probe]!;
          const x = column + offsets.dx[probe]!;
          if (y < 0 || y >= side || x < 0 || x >= side) continue;
          if (coverage[y * side + x] === 1) {
            source = y * side + x;
            break;
          }
        }
      }
      if (source >= 0) rgba.copyWithin(at * 4, source * 4, source * 4 + 4);
      else rgba.set(FLAT, at * 4);
    }
  }
}
