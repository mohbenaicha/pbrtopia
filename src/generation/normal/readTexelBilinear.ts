// Reads an RGBA picture at a fractional texel position (texel centres at +0.5), clamping at the edges. Returns the first three channels.
export function readTexelBilinear(rgba: Uint8ClampedArray, side: number, x: number, y: number, out: [number, number, number]): void {
  const x0 = Math.floor(x - 0.5);
  const y0 = Math.floor(y - 0.5);
  const fx = x - 0.5 - x0;
  const fy = y - 0.5 - y0;
  const at = (xx: number, yy: number): number => (Math.min(side - 1, Math.max(0, yy)) * side + Math.min(side - 1, Math.max(0, xx))) * 4;
  const a = at(x0, y0);
  const b = at(x0 + 1, y0);
  const c = at(x0, y0 + 1);
  const d = at(x0 + 1, y0 + 1);
  for (let k = 0; k < 3; k += 1) {
    out[k] = rgba[a + k]! * (1 - fx) * (1 - fy) + rgba[b + k]! * fx * (1 - fy) + rgba[c + k]! * (1 - fx) * fy + rgba[d + k]! * fx * fy;
  }
}
