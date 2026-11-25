/** Reads a square float picture at a fractional texel position (texel centres at +0.5), clamping at the edges. */
export function sampleFloatBilinear(values: Float32Array, side: number, x: number, y: number): number {
  const x0 = Math.floor(x - 0.5);
  const y0 = Math.floor(y - 0.5);
  const fx = x - 0.5 - x0;
  const fy = y - 0.5 - y0;
  const clamp = (v: number): number => Math.min(side - 1, Math.max(0, v));
  const at = (xx: number, yy: number): number => values[clamp(yy) * side + clamp(xx)]!;
  return at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
}
