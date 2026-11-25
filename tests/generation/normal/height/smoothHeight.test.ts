import { describe, expect, it } from 'vitest';
import { smoothHeight } from '../../../../src/generation/normal/height/smoothHeight';
import type { PixelPicture } from '../../../../src/generation/normal/uprightTypes';

/** A grey base height picture (R = G = B = level, alpha 255) from a function of the texel. */
function greyPicture(side: number, level: (x: number, y: number) => number): PixelPicture {
  const rgba = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) rgba.set([level(x, y), level(x, y), level(x, y), 255], (y * side + x) * 4);
  return { side, rgba };
}
const oneIsland = (side: number): Uint16Array => new Uint16Array(side * side).fill(1);

describe('smoothHeight', () => {
  it('normal-height-edit R3 a flat height stays flat and its p95 slope is 0', () => {
    const side = 64;
    const result = smoothHeight(greyPicture(side, () => 102), oneIsland(side));
    for (const value of result.smoothed) expect(value).toBeCloseTo(0.4, 5);
    expect(result.p95).toBeCloseTo(0, 6);
  });

  it('normal-height-edit R3 an impulse spreads with sigma side / 1100 (variance within 5%)', () => {
    const side = 1100; // sigma 1.0 texel
    const result = smoothHeight(greyPicture(side, (x, y) => (x === 550 && y === 550 ? 255 : 0)), oneIsland(side));
    let total = 0;
    let spread = 0;
    for (let x = 540; x < 560; x += 1) {
      const weight = result.smoothed[550 * side + x]!;
      total += weight;
      spread += weight * (x - 550) * (x - 550);
    }
    expect(spread / total).toBeGreaterThan(0.95);
    expect(spread / total).toBeLessThan(1.05);
  });

  it('normal-height-edit R3 another island\'s heights do not leak across the border', () => {
    const side = 64;
    const owner = new Uint16Array(side * side);
    for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) owner[y * side + x] = x < 32 ? 1 : 2;
    const result = smoothHeight(greyPicture(side, (x) => (x < 32 ? 51 : 204)), owner);
    for (let y = 0; y < side; y += 1) {
      for (let x = 28; x < 36; x += 1) expect(result.smoothed[y * side + x]).toBeCloseTo(x < 32 ? 0.2 : 0.8, 5);
    }
  });

  it('normal-height-edit R3 texels of no island hold 0', () => {
    const side = 32;
    const owner = oneIsland(side);
    owner.fill(0, 0, side * 4);
    const result = smoothHeight(greyPicture(side, () => 200), owner);
    for (let i = 0; i < side * 4; i += 1) expect(result.smoothed[i]).toBe(0);
    expect(result.smoothed[side * 10 + 10]).toBeCloseTo(200 / 255, 5);
  });

  it('normal-height-edit R6 P95 is the 95th percentile slope of the smoothed height (a ramp of 3 levels per texel gives 3/255)', () => {
    const side = 80;
    const result = smoothHeight(greyPicture(side, (x) => x * 3), oneIsland(side)); // sigma is 0.07 texel here: the blur changes nothing
    expect(result.p95).toBeCloseTo(3 / 255, 4);
  });

  it('normal-height-edit R8 the result is the same every time and keeps the owner map and side', () => {
    const side = 48;
    const picture = greyPicture(side, (x, y) => (x * 7 + y * 3) % 256);
    const owner = oneIsland(side);
    const one = smoothHeight(picture, owner);
    const two = smoothHeight(picture, owner);
    expect(Array.from(one.smoothed)).toEqual(Array.from(two.smoothed));
    expect(one.p95).toBe(two.p95);
    expect(one.owner).toBe(owner);
    expect(one.side).toBe(side);
  });
});
