// normal-reauthor R8 (also mask-mode R28): which texels of a square picture lie under the mesh's UV layout. No DOM, no store.
import type { UvMesh } from '../generation/normal/uprightTypes';

const DEGENERATE_AREA = 1e-6; // texels squared: a triangle thinner than this covers nothing

/** One byte per texel: 1 where the texel centre lies inside (edges inclusive) a triangle of the layout, else 0. Texel (column, row) has its centre at (column + 0.5, row + 0.5); v runs down. */
export function rasterizeIslandCoverage(mesh: UvMesh, side: number): Uint8Array {
  const coverage = new Uint8Array(side * side);
  const { uvs, indices } = mesh;
  for (let at = 0; at + 2 < indices.length; at += 3) {
    const a = indices[at]! * 2;
    const b = indices[at + 1]! * 2;
    const c = indices[at + 2]! * 2;
    const ax = uvs[a]! * side;
    const ay = uvs[a + 1]! * side;
    const bx = uvs[b]! * side;
    const by = uvs[b + 1]! * side;
    const cx = uvs[c]! * side;
    const cy = uvs[c + 1]! * side;
    if (Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) < DEGENERATE_AREA) continue;
    const firstColumn = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 0.5));
    const lastColumn = Math.min(side - 1, Math.ceil(Math.max(ax, bx, cx) - 0.5));
    const firstRow = Math.max(0, Math.floor(Math.min(ay, by, cy) - 0.5));
    const lastRow = Math.min(side - 1, Math.ceil(Math.max(ay, by, cy) - 0.5));
    for (let row = firstRow; row <= lastRow; row += 1) {
      const py = row + 0.5;
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const px = column + 0.5;
        const e0 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
        const e1 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
        const e2 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
        if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) coverage[row * side + column] = 1;
      }
    }
  }
  return coverage;
}
