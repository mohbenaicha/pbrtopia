import { describe, expect, it } from 'vitest';
import { scaleSlope } from '../../../../src/generation/normal/reauthor/scaleSlope';
import type { PixelPicture } from '../../../../src/generation/normal/uprightTypes';
import { FLAT, encodeNormal, solidPicture } from './reauthorFixtures';

const tilted = (): PixelPicture => solidPicture(2, [218, 128, 218, 255]); // decodes to (0.709, 0, 0.709): slope x = 1

describe('scaleSlope', () => {
  it('normal-reauthor R5 a flat texel has slope 0 at every slope strength', () => {
    for (const degrees of [5, 45, 80]) {
      const slopes = scaleSlope(solidPicture(2, FLAT), degrees);
      expect(slopes.length).toBe(2 * 2 * 2);
      expect(Array.from(slopes).every((value) => value === 0)).toBe(true);
    }
  });

  it('normal-reauthor R5 the slope is x / z at 45 degrees (decode (v - 128) / 127)', () => {
    const slopes = scaleSlope(tilted(), 45);
    expect(slopes[0]).toBeCloseTo(1, 6);
    expect(slopes[1]).toBeCloseTo(0, 6);
  });

  it('normal-reauthor R5 the slope scales by tan(slopeDeg) / tan(45)', () => {
    expect(scaleSlope(tilted(), 80)[0]).toBeCloseTo(5.671281819617707, 5);
    expect(scaleSlope(tilted(), 5)[0]).toBeCloseTo(0.08748866352592401, 6);
    expect(scaleSlope(tilted(), 30)[0]).toBeCloseTo(Math.tan((30 * Math.PI) / 180), 6);
  });

  it('normal-reauthor R5 the y slope scales the same way and keeps its sign', () => {
    const slopes = scaleSlope(solidPicture(1, encodeNormal(0, -0.5, 0.866)), 80);
    expect(slopes[0]).toBeCloseTo(0, 6);
    expect(slopes[1]!).toBeLessThan(-2);
  });

  it('normal-reauthor R5 a texel with z <= 0 is read as flat', () => {
    const slopes = scaleSlope(solidPicture(1, [200, 128, 100, 255]), 45);
    expect(slopes[0]).toBe(0);
    expect(slopes[1]).toBe(0);
    expect(Array.from(scaleSlope(solidPicture(1, [200, 128, 128, 255]), 45))).toEqual([0, 0]); // z exactly 0
  });

  it('normal-reauthor R5 the input picture is not changed', () => {
    const base = tilted();
    const before = Array.from(base.rgba);
    scaleSlope(base, 70);
    expect(Array.from(base.rgba)).toEqual(before);
  });
});
