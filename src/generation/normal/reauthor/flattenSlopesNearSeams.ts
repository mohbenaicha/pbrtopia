// normal-reauthor R6: slopes shrink toward 0 near a seam, with the same factor on both sides. No DOM, no store.

/** Multiplies each texel's slope by 1 - flatten * (1 - smoothstep(0, radius, distance)); changes `slopes` in place. flatten is 0..1. */
export function flattenSlopesNearSeams(slopes: Float32Array, distance: Float32Array, radiusTexels: number, flatten: number): void {
  if (radiusTexels <= 0 || flatten <= 0) return;
  for (let at = 0; at < distance.length; at += 1) {
    const d = distance[at]!;
    if (d >= radiusTexels) continue;
    const t = d / radiusTexels;
    const factor = 1 - flatten * (1 - t * t * (3 - 2 * t));
    slopes[at * 2] = slopes[at * 2]! * factor;
    slopes[at * 2 + 1] = slopes[at * 2 + 1]! * factor;
  }
}
