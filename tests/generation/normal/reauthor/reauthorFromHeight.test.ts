import { describe, expect, it } from 'vitest';
import { buildOwnerMap } from '../../../../src/generation/normal/height/buildOwnerMap';
import { smoothHeight } from '../../../../src/generation/normal/height/smoothHeight';
import { createHeightReauthorer, reauthorFromHeight } from '../../../../src/generation/normal/reauthor/reauthorFromHeight';
import type { ReauthorParams } from '../../../../src/normalRecipe/reauthorParams';
import type { PixelPicture } from '../../../../src/generation/normal/uprightTypes';
import { FLAT, texelAt, twoWallsWithSeam } from './reauthorFixtures';

const SIDE = 512; // wall A is texels 51..205 across and down, wall B 307..461
const PARAMS: ReauthorParams = { slopeDeg: 45, seamRadius: 4, seamFlatten: 0, sharpness: 0 };

// A roof of 3 levels per texel (p95 slope 3/255, above the 0.01 floor): wall A peaks at x = 128 and rises again toward its seam edge at x = 205; wall B the same in y around 384.
function greyHeight(): PixelPicture {
  const rgba = new Uint8ClampedArray(SIDE * SIDE * 4);
  for (let y = 0; y < SIDE; y += 1) {
    for (let x = 0; x < SIDE; x += 1) {
      const level = x < 307 ? 3 * Math.abs(x - 128) : 3 * Math.abs(y - 384);
      rgba.set([level, level, level, 255], (y * SIDE + x) * 4);
    }
  }
  return { side: SIDE, rgba };
}

const mesh = twoWallsWithSeam();
const smoothed = () => smoothHeight(greyHeight(), buildOwnerMap(mesh, SIDE));
const tiltDeg = (texel: number[]): number => {
  const x = (texel[0]! - 128) / 127;
  const y = (texel[1]! - 128) / 127;
  const z = (texel[2]! - 128) / 127;
  return (Math.atan2(Math.hypot(x, y), z) * 180) / Math.PI;
};
const differs = (a: PixelPicture, b: PixelPicture): boolean => a.rgba.some((value, i) => value !== b.rgba[i]);

describe('reauthorFromHeight', () => {
  it('normal-height-edit R6 a ramp comes out tilted slopeDeg degrees at its p95, leaning against the rising height', () => {
    const height = smoothed();
    for (const degrees of [30, 45, 60]) {
      const texel = texelAt(reauthorFromHeight(height, mesh, { ...PARAMS, slopeDeg: degrees }), 160, 100);
      expect(Math.abs(tiltDeg(texel) - degrees)).toBeLessThan(2);
      expect(texel[0]!).toBeLessThan(128); // height rises with x here: the normal leans to -x
    }
  });

  it('normal-height-edit R7 texels outside every island are flat after the fill', () => {
    const result = reauthorFromHeight(smoothed(), mesh, PARAMS);
    for (const [x, y] of [[5, 5], [250, 400], [500, 500]] as const) expect(texelAt(result, x, y)).toEqual(FLAT);
  });

  it('normal-height-edit R7 Seam flatten lowers the slope near a seam, and a later release is not stacked on an earlier one', () => {
    const height = smoothed();
    const seamTexel = [204, 100] as const; // wall A's edge x = 1 is the seam (texel 204.8)
    const open = reauthorFromHeight(height, mesh, { ...PARAMS, seamRadius: 8, seamFlatten: 0 });
    const flattened = reauthorFromHeight(height, mesh, { ...PARAMS, seamRadius: 8, seamFlatten: 100 });
    expect(tiltDeg(texelAt(flattened, ...seamTexel))).toBeLessThan(tiltDeg(texelAt(open, ...seamTexel)) - 5);
    const again = reauthorFromHeight(height, mesh, { ...PARAMS, seamRadius: 8, seamFlatten: 0 });
    expect(Array.from(again.rgba)).toEqual(Array.from(open.rgba));
  });

  it('normal-height-edit R5.4 Sharpness makes a slope steeper at the ramp\'s end, and 0 equals no sharpness', () => {
    const height = smoothed();
    const plain = reauthorFromHeight(height, mesh, PARAMS);
    const sharp = reauthorFromHeight(height, mesh, { ...PARAMS, sharpness: 2 });
    const peakTilt = (picture: PixelPicture): number => Math.max(...Array.from({ length: 154 }, (_, i) => tiltDeg(texelAt(picture, 51 + i, 100))));
    expect(peakTilt(sharp)).toBeGreaterThan(peakTilt(plain) + 3);
    expect(differs(plain, reauthorFromHeight(height, mesh, { ...PARAMS, sharpness: 0 }))).toBe(false);
  });

  it('normal-height-edit R8 the inputs are not changed and the same inputs give the same bytes', () => {
    const height = smoothed();
    const before = Array.from(height.smoothed);
    const one = reauthorFromHeight(height, mesh, { ...PARAMS, sharpness: 1.5, seamFlatten: 100 });
    const two = reauthorFromHeight(height, mesh, { ...PARAMS, sharpness: 1.5, seamFlatten: 100 });
    expect(Array.from(one.rgba)).toEqual(Array.from(two.rgba));
    expect(Array.from(height.smoothed)).toEqual(before);
  });

  it('normal-height-edit R11 each slider only redoes what it changes, and every path gives the one-shot bytes', () => {
    const height = smoothed();
    const reauthorer = createHeightReauthorer(height, mesh);
    reauthorer.prepare();
    expect(reauthorer.stats).toEqual({ deltas: 1, workingHeights: 0, unitSlopes: 0 });
    const steps: ReauthorParams[] = [
      { slopeDeg: 45, seamRadius: 4, seamFlatten: 100, sharpness: 0 },
      { slopeDeg: 60, seamRadius: 4, seamFlatten: 100, sharpness: 0 }, // strength
      { slopeDeg: 60, seamRadius: 9, seamFlatten: 100, sharpness: 0 }, // blend
      { slopeDeg: 60, seamRadius: 9, seamFlatten: 40, sharpness: 0 }, // flatten
    ];
    for (const params of steps) expect(Array.from(reauthorer.reauthor(params).rgba)).toEqual(Array.from(reauthorFromHeight(height, mesh, params).rgba));
    expect(reauthorer.stats).toEqual({ deltas: 1, workingHeights: 0, unitSlopes: 1 }); // strength, blend and flatten reused the unit slopes
    const sharp: ReauthorParams = { ...steps[3]!, sharpness: 1.25 };
    expect(Array.from(reauthorer.reauthor(sharp).rgba)).toEqual(Array.from(reauthorFromHeight(height, mesh, sharp).rgba));
    expect(reauthorer.stats).toEqual({ deltas: 1, workingHeights: 1, unitSlopes: 2 }); // Sharpness rebuilt the working height and the unit slopes once
    reauthorer.reauthor({ ...sharp, slopeDeg: 30 });
    expect(reauthorer.stats).toEqual({ deltas: 1, workingHeights: 1, unitSlopes: 2 });
  });

  it('normal-height-edit R11 the sharpness deltas are computed once and only when needed', () => {
    const reauthorer = createHeightReauthorer(smoothed(), mesh);
    reauthorer.reauthor(PARAMS);
    expect(reauthorer.stats.deltas).toBe(0); // generation at Sharpness 0 never pays for them
    reauthorer.reauthor({ ...PARAMS, sharpness: 1 });
    reauthorer.reauthor({ ...PARAMS, sharpness: 2 });
    expect(reauthorer.stats.deltas).toBe(1);
  });
});
