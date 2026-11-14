import type { Point } from '../plan/planStamps';

type Vec3 = readonly [number, number, number];

/**
 * Compositing R27: the displaced surface of the Plane in its own frame (x, y in [-0.5, 0.5], z up). `height(u, v)` reads the 0-1 height at a picture coordinate
 * (the caller wraps it); the surface at (x, y) is z = height x scale + bias, the preview's displacement (preview R15: scale = contrast x heightScale / max(tiling, 1),
 * bias = -level x scale).
 */
export interface PickField {
  height(u: number, v: number): number;
  scale: number;
  bias: number;
  tilingX: number;
  tilingY: number;
}

const STEPS = 96;
const BISECTIONS = 5;
const EPSILON = 1e-9;

/**
 * Compositing R27: the picture coordinate (plane uv x tiling, unwrapped) where a ray meets the displaced Plane, or null. The ray is marched through the slab the
 * surface can lie in, 96 steps, then refined by bisection; a flat plane is the plain intersection. Pure.
 */
export function pickSurface(origin: Vec3, direction: Vec3, field: PickField): Point | null {
  if (direction[2] >= -EPSILON) return null; // looking up or sideways cannot reach a surface below
  const top = Math.max(field.bias, field.scale + field.bias);
  const bottom = Math.min(field.bias, field.scale + field.bias);
  const tEnter = Math.max((top - origin[2]) / direction[2], 0);
  const tExit = (bottom - origin[2]) / direction[2];
  if (tExit < 0) return null;
  const at = (t: number): [number, number, number] => [origin[0] + direction[0] * t, origin[1] + direction[1] * t, origin[2] + direction[2] * t];
  const inside = (p: readonly number[]): boolean => Math.abs(p[0]!) <= 0.5 && Math.abs(p[1]!) <= 0.5;
  const above = (t: number): number => {
    const p = at(t);
    return p[2] - (field.height((p[0] + 0.5) * field.tilingX, (p[1] + 0.5) * field.tilingY) * field.scale + field.bias);
  };
  let previous = tEnter;
  for (let step = 0; step <= STEPS; step += 1) {
    const t = tEnter + ((tExit - tEnter) * step) / STEPS;
    if (above(t) <= EPSILON) {
      let low = previous; // above the surface
      let high = t; // at or below it
      if (step > 0) for (let index = 0; index < BISECTIONS; index += 1) { const middle = (low + high) / 2; if (above(middle) <= EPSILON) high = middle; else low = middle; }
      const hit = at(step === 0 ? tEnter : high);
      return inside(hit) ? { x: (hit[0] + 0.5) * field.tilingX, y: (hit[1] + 0.5) * field.tilingY } : null;
    }
    previous = t;
  }
  return null;
}

/** Compositing R26 R27: bilinear reads of a square one-byte height proxy with wrap; texel i is centred at (i + 0.5) / side; rows are texture rows (v up). */
export function createHeightProxy(bytes: Uint8Array, side: number): (u: number, v: number) => number {
  const wrap = (index: number): number => ((index % side) + side) % side;
  return (u, v) => {
    const x = u * side - 0.5;
    const y = v * side - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const read = (ix: number, iy: number): number => bytes[wrap(iy) * side + wrap(ix)]! / 255;
    return (read(x0, y0) * (1 - fx) + read(x0 + 1, y0) * fx) * (1 - fy) + (read(x0, y0 + 1) * (1 - fx) + read(x0 + 1, y0 + 1) * fx) * fy;
  };
}
