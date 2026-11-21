import { PIECE_PADDING_PX, type UvMesh } from './uprightTypes';

export const GROWTH = 1; // a mask texel within PIECE_PADDING_PX of a triangle but inside none
export const INSIDE = 2; // a mask texel whose centre is inside a triangle of the island

export interface IslandMask {
  minX: number;
  minY: number;
  width: number;
  height: number;
  mask: Uint8Array; // 0 outside, INSIDE where the texel centre is inside a triangle of the island, GROWTH where it is only within PIECE_PADDING_PX of one
  points: Float32Array; // the island's triangle corners in texels (x, y pairs)
}

function distanceToSegmentSquared(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

/** normal-map R15: the island's triangles rasterised in the source albedo's texels and grown by PIECE_PADDING_PX. */
export function rasterizeIslandMask(mesh: UvMesh, triangles: readonly number[], side: number): IslandMask {
  const points = new Float32Array(triangles.length * 6);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  triangles.forEach((t, n) => {
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = mesh.indices[t * 3 + corner]!;
      const x = mesh.uvs[vertex * 2]! * side;
      const y = mesh.uvs[vertex * 2 + 1]! * side;
      points[n * 6 + corner * 2] = x;
      points[n * 6 + corner * 2 + 1] = y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  });
  const originX = Math.floor(minX) - PIECE_PADDING_PX;
  const originY = Math.floor(minY) - PIECE_PADDING_PX;
  const width = Math.ceil(maxX) + PIECE_PADDING_PX - originX;
  const height = Math.ceil(maxY) + PIECE_PADDING_PX - originY;
  const mask = new Uint8Array(width * height);
  const limit = PIECE_PADDING_PX * PIECE_PADDING_PX;

  for (let n = 0; n < triangles.length; n += 1) {
    const ax = points[n * 6]! - originX;
    const ay = points[n * 6 + 1]! - originY;
    const bx = points[n * 6 + 2]! - originX;
    const by = points[n * 6 + 3]! - originY;
    const cx = points[n * 6 + 4]! - originX;
    const cy = points[n * 6 + 5]! - originY;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - PIECE_PADDING_PX));
    const x1 = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx) + PIECE_PADDING_PX));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - PIECE_PADDING_PX));
    const y1 = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy) + PIECE_PADDING_PX));
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    const sign = area >= 0 ? 1 : -1;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const at = y * width + x;
        if (mask[at] === INSIDE) continue;
        const px = x + 0.5;
        const py = y + 0.5;
        const inside =
          area !== 0 &&
          sign * ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) >= 0 &&
          sign * ((cx - bx) * (py - by) - (cy - by) * (px - bx)) >= 0 &&
          sign * ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) >= 0;
        if (inside) mask[at] = INSIDE;
        else if (
          mask[at] === 0 &&
          (distanceToSegmentSquared(px, py, ax, ay, bx, by) <= limit ||
            distanceToSegmentSquared(px, py, bx, by, cx, cy) <= limit ||
            distanceToSegmentSquared(px, py, cx, cy, ax, ay) <= limit)
        ) {
          mask[at] = GROWTH;
        }
      }
    }
  }
  return { minX: originX, minY: originY, width, height, mask, points };
}
