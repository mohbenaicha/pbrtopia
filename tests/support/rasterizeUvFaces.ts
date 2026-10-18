import type { BufferGeometry } from 'three';

export interface RasterizedUvFaces {
  color: Uint8ClampedArray; // RGBA, top row first; alpha 255 under the mesh, 0 elsewhere
  covered: Uint8Array; // 1 where a covering face painted the texel
  meshTexels: number;
}

// Rasterises the mesh's UV triangles (texel centres inside a triangle count) into a sizePx x sizePx image. Faces for which
// `coverFace` returns a colour are painted and marked covered; the other mesh texels stay black and uncovered.
export function rasterizeUvFaces(
  geometry: BufferGeometry,
  sizePx: number,
  coverFace: (face: number) => [number, number, number] | undefined,
): RasterizedUvFaces {
  const uv = geometry.getAttribute('uv');
  const index = geometry.index!;
  const color = new Uint8ClampedArray(sizePx * sizePx * 4);
  const covered = new Uint8Array(sizePx * sizePx);
  const faceCount = index.count / 3;
  for (let face = 0; face < faceCount; face += 1) {
    const corners = [0, 1, 2].map((k) => index.getX(face * 3 + k));
    const [ax, ay, bx, by, cx, cy] = corners.flatMap((v) => [uv.getX(v) * sizePx, uv.getY(v) * sizePx]) as [number, number, number, number, number, number];
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-9) continue;
    const paint = coverFace(face);
    for (let y = Math.max(0, Math.floor(Math.min(ay, by, cy))); y <= Math.min(sizePx - 1, Math.ceil(Math.max(ay, by, cy))); y += 1) {
      for (let x = Math.max(0, Math.floor(Math.min(ax, bx, cx))); x <= Math.min(sizePx - 1, Math.ceil(Math.max(ax, bx, cx))); x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const l0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
        const l1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
        const l2 = 1 - l0 - l1;
        if (l0 < -1e-9 || l1 < -1e-9 || l2 < -1e-9) continue;
        const texel = y * sizePx + x;
        color[texel * 4 + 3] = 255;
        if (paint && !covered[texel]) {
          covered[texel] = 1;
          color.set(paint, texel * 4);
        }
      }
    }
  }
  let meshTexels = 0;
  for (let t = 0; t < sizePx * sizePx; t += 1) if (color[t * 4 + 3]! > 127) meshTexels += 1;
  return { color, covered, meshTexels };
}
