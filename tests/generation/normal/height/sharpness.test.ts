import { describe, expect, it } from 'vitest';
import { buildWorkingHeight } from '../../../../src/generation/normal/height/buildWorkingHeight';
import { prepareSharpness } from '../../../../src/generation/normal/height/prepareSharpness';
import { FADE_RANGE, RADII_AT_1024 } from '../../../../src/generation/normal/height/heightTypes';
import { seededRandom } from '../reauthor/reauthorFixtures';
import { soleIslandHeight, twoIslandHeight } from './heightFixtures';

const SIDE = 64; // radii 8, 32, 128 scale to 0.5 -> 1, 2, 8 texels: every window is at full resolution here (no pooling)
const smoothstep = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** The R4 pass written straight from its text: per texel, per radius, the window over the texels of the same island, no caching. */
function directPass(values: Float32Array, owner: Uint16Array, side: number, p: number): Float32Array {
  const out = new Float32Array(values.length);
  const radii = RADII_AT_1024.map((r) => Math.max(1, Math.round((r * side) / 1024)));
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const at = y * side + x;
      if (owner[at] === 0) continue;
      let sum = 0;
      for (const rho of radii) {
        let lo = Infinity;
        let hi = -Infinity;
        for (let wy = Math.max(0, y - rho); wy <= Math.min(side - 1, y + rho); wy += 1) {
          for (let wx = Math.max(0, x - rho); wx <= Math.min(side - 1, x + rho); wx += 1) {
            const w = wy * side + wx;
            if (owner[w] !== owner[at]) continue;
            lo = Math.min(lo, values[w]!);
            hi = Math.max(hi, values[w]!);
          }
        }
        const range = hi - lo;
        if (range <= 0) {
          sum += values[at]!;
          continue;
        }
        const u = Math.min(1, Math.max(0, (values[at]! - lo) / range));
        const s = u * u * (3 - 2 * u);
        sum += lo + range * (u + p * smoothstep(range / FADE_RANGE) * (s - u));
      }
      out[at] = sum / radii.length;
    }
  }
  return out;
}
const directSharpen = (values: Float32Array, owner: Uint16Array, side: number, a: number): Float32Array =>
  a <= 0 ? values : a <= 1 ? directPass(values, owner, side, a) : directPass(directPass(values, owner, side, 1), owner, side, a - 1);

const random = (seed: number) => {
  const next = seededRandom(seed);
  return () => next();
};

describe('prepareSharpness and buildWorkingHeight', () => {
  const rough = (seed: number) => {
    const next = random(seed);
    return soleIslandHeight(SIDE, (x, y) => 0.5 + 0.3 * Math.sin(x / 5) * Math.cos(y / 7) + 0.05 * next());
  };

  it('normal-height-edit R4 the cached linear form equals the pass written from its text, at 0.3, 1, 1.5 and 2', () => {
    const picture = rough(7);
    const deltas = prepareSharpness(picture);
    for (const amount of [0.3, 1, 1.5, 2]) {
      const cached = buildWorkingHeight(picture, deltas, amount);
      const direct = directSharpen(picture.smoothed, picture.owner, SIDE, amount);
      let worst = 0;
      for (let i = 0; i < cached.length; i += 1) worst = Math.max(worst, Math.abs(cached[i]! - direct[i]!));
      expect(worst).toBeLessThan(1e-5);
    }
  });

  it('normal-height-edit R4 amount 0 returns the smoothed height unchanged', () => {
    const picture = rough(3);
    const working = buildWorkingHeight(picture, prepareSharpness(picture), 0);
    expect(Array.from(working)).toEqual(Array.from(picture.smoothed));
  });

  it('normal-height-edit R4 the one-pass and two-pass halves meet at amount 1 (no jump)', () => {
    const picture = rough(9);
    const deltas = prepareSharpness(picture);
    const below = buildWorkingHeight(picture, deltas, 1);
    const above = buildWorkingHeight(picture, deltas, 1.0000001);
    let worst = 0;
    for (let i = 0; i < below.length; i += 1) worst = Math.max(worst, Math.abs(below[i]! - above[i]!));
    expect(worst).toBeLessThan(1e-5);
  });

  it('normal-height-edit R5.1 a flat height stays flat at every amount', () => {
    const picture = soleIslandHeight(SIDE, () => 0.37);
    const deltas = prepareSharpness(picture);
    for (const amount of [0, 0.5, 1, 1.5, 2]) {
      const working = buildWorkingHeight(picture, deltas, amount);
      for (const value of working) expect(value).toBeCloseTo(0.37, 6);
    }
  });

  it('normal-height-edit R5.2 no texel leaves the range of its own island, at 0.5, 1, 1.5 and 2 (random heights)', () => {
    for (const seed of [1, 2, 3]) {
      const next = random(seed);
      const picture = twoIslandHeight(SIDE, 30, () => 0.1 + 0.4 * next(), () => 0.6 + 0.4 * next());
      const deltas = prepareSharpness(picture);
      for (const amount of [0.5, 1, 1.5, 2]) {
        const working = buildWorkingHeight(picture, deltas, amount);
        for (let i = 0; i < working.length; i += 1) {
          const [lo, hi] = picture.owner[i] === 1 ? [0.1, 0.5] : [0.6, 1];
          expect(working[i]!).toBeGreaterThanOrEqual(lo - 1e-6);
          expect(working[i]!).toBeLessThanOrEqual(hi + 1e-6);
        }
      }
    }
  });

  it('normal-height-edit R5.7 an island\'s output does not depend on another island\'s heights', () => {
    const next = random(11);
    const leftValues = Array.from({ length: SIDE * SIDE }, () => 0.2 + 0.3 * next());
    const rightA = Array.from({ length: SIDE * SIDE }, () => 0.5 + 0.5 * next());
    const rightB = Array.from({ length: SIDE * SIDE }, () => 0.5 + 0.5 * next());
    const make = (right: number[]) => twoIslandHeight(SIDE, 30, (x, y) => leftValues[y * SIDE + x]!, (x, y) => right[y * SIDE + x]!);
    const one = make(rightA);
    const two = make(rightB);
    const workingOne = buildWorkingHeight(one, prepareSharpness(one), 2);
    const workingTwo = buildWorkingHeight(two, prepareSharpness(two), 2);
    for (let y = 0; y < SIDE; y += 1) for (let x = 0; x < 30; x += 1) expect(workingOne[y * SIDE + x]).toBe(workingTwo[y * SIDE + x]);
  });

  it('normal-height-edit R4 texels of no island stay 0, and the pooled windows (side 512) keep every texel inside the picture\'s range', () => {
    const big = soleIslandHeight(512, (x, y) => 0.5 + 0.4 * Math.sin(x / 30) * Math.cos(y / 40));
    big.owner.fill(0, 0, 512 * 10); // the first rows belong to nobody, and hold no height
    big.smoothed.fill(0, 0, 512 * 10);
    const working = buildWorkingHeight(big, prepareSharpness(big), 2);
    for (let i = 0; i < 512 * 10; i += 1) expect(working[i]).toBe(0);
    for (let i = 512 * 10; i < working.length; i += 1) {
      expect(working[i]!).toBeGreaterThanOrEqual(0.1 - 1e-6);
      expect(working[i]!).toBeLessThanOrEqual(0.9 + 1e-6);
    }
  }, 30_000); // a 512 side picture through every radius: seconds when the whole suite runs in parallel
});
