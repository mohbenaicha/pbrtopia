import { MAX_SHARPNESS, type SharpnessDeltas, type SmoothedHeight } from './heightTypes';

/**
 * normal-height-edit R4, R5: the working height at Sharpness `amount` (0 to 2): `h + a*d0` up to 1, then `h + d0 + (a - 1)*d1`. One multiply-add per texel; texels of no island
 * hold 0 in `smoothed` and in both deltas, so they stay 0.
 */
export function buildWorkingHeight(height: SmoothedHeight, deltas: SharpnessDeltas, amount: number): Float32Array {
  const { smoothed } = height;
  const a = Math.min(MAX_SHARPNESS, Math.max(0, amount));
  const out = new Float32Array(smoothed.length);
  if (a <= 1) for (let i = 0; i < out.length; i += 1) out[i] = smoothed[i]! + a * deltas.d0[i]!;
  else for (let i = 0; i < out.length; i += 1) out[i] = smoothed[i]! + deltas.d0[i]! + (a - 1) * deltas.d1[i]!;
  return out;
}
