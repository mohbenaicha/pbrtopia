import type { BufferGeometry } from 'three';

const EDGE_SLACK = 1e-9; // a texel centre on a triangle's edge counts as inside it

/** Adds 1 to `mark` for every texel whose centre lies inside triangle (ax,ay), (bx,by), (cx,cy), given in texel units. */
function rasteriseTriangle(mark: Uint8Array, sizePx: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): void {
  const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (Math.abs(area) < 1e-12) return;
  const sign = area > 0 ? 1 : -1;
  const xFrom = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 0.5));
  const xTo = Math.min(sizePx - 1, Math.ceil(Math.max(ax, bx, cx) - 0.5));
  const yFrom = Math.max(0, Math.floor(Math.min(ay, by, cy) - 0.5));
  const yTo = Math.min(sizePx - 1, Math.ceil(Math.max(ay, by, cy) - 0.5));
  for (let y = yFrom; y <= yTo; y += 1) {
    for (let x = xFrom; x <= xTo; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) * sign;
      const w1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) * sign;
      const w2 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) * sign;
      if (w0 >= -EDGE_SLACK && w1 >= -EDGE_SLACK && w2 >= -EDGE_SLACK) mark[y * sizePx + x] = 1;
    }
  }
}

/**
 * Mesh edit R30: the texels of an S x S UV square that lie under a hidden triangle and under no visible one (1), for the bake to leave alone.
 * A texel belongs to a triangle when its centre is inside it (on an edge counts); where a visible triangle shares the texel, the visible one wins.
 * Row 0 is v = 0, like the bake's pixels. `null` when no triangle is hidden or the geometry has no UVs (nothing to protect, no memory kept).
 */
export function buildHiddenTexelMask(fullGeometry: BufferGeometry, hiddenFlags: Uint8Array, sizePx: number): Uint8Array | null {
  const uv = fullGeometry.getAttribute('uv');
  if (!uv || !hiddenFlags.some((flag) => flag === 1)) return null;
  const index = fullGeometry.index;
  const triangleCount = (index ? index.count : fullGeometry.getAttribute('position').count) / 3;
  const corner = (triangle: number, k: number): number => (index ? index.getX(triangle * 3 + k) : triangle * 3 + k);
  const hiddenMark = new Uint8Array(sizePx * sizePx);
  const visibleMark = new Uint8Array(sizePx * sizePx);
  for (let t = 0; t < triangleCount; t += 1) {
    const [a, b, c] = [corner(t, 0), corner(t, 1), corner(t, 2)];
    rasteriseTriangle(hiddenFlags[t] === 1 ? hiddenMark : visibleMark, sizePx, uv.getX(a) * sizePx, uv.getY(a) * sizePx, uv.getX(b) * sizePx, uv.getY(b) * sizePx, uv.getX(c) * sizePx, uv.getY(c) * sizePx);
  }
  for (let t = 0; t < hiddenMark.length; t += 1) if (visibleMark[t] === 1) hiddenMark[t] = 0;
  return hiddenMark;
}
