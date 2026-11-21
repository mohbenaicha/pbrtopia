import { describe, expect, it } from 'vitest';
import { deltaE76, hexToRgb, rgbToLab } from '@shared/materialMasks/color/lab';

describe('materialgen/masks color', () => {
  it('R18 white is L 100 and black is L 0, both without hue', () => {
    const [lightness, a, b] = rgbToLab(255, 255, 255);
    expect(lightness).toBeCloseTo(100, 1);
    expect(a).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
    expect(rgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 5);
  });

  it('R18 sRGB red is the known Lab value under D65', () => {
    const [lightness, a, b] = rgbToLab(255, 0, 0);
    expect(lightness).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 1);
    expect(b).toBeCloseTo(67.2, 1);
  });

  it('R18 delta E is the plain distance in Lab: zero for one colour, symmetric, and positive otherwise', () => {
    const red = rgbToLab(255, 0, 0);
    const green = rgbToLab(0, 255, 0);
    expect(deltaE76(red, red)).toBe(0);
    expect(deltaE76(red, green)).toBeCloseTo(deltaE76(green, red), 10);
    expect(deltaE76(red, green)).toBeGreaterThan(100);
  });

  it('R10 a hex colour is read as its three channels', () => {
    expect(hexToRgb('#FF8000')).toEqual([255, 128, 0]);
    expect(hexToRgb('00ff00')).toEqual([0, 255, 0]);
  });
});
