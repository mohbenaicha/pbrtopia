import { describe, expect, it } from 'vitest';
import { PALETTE, deltaE76, hexToRgb, paletteFor, rgbToLab } from '../../../src/materialMasks';
import { paletteForRecord } from '../../../src/materialMasks/palette/paletteForRecord';

const lab = (hex: string) => rgbToLab(...hexToRgb(hex));

describe('paletteForRecord (mask-mode R13)', () => {
  it('mask-mode R13 up to 10 entries equal the shared palette', () => {
    expect(paletteForRecord(7)).toEqual(paletteFor(7));
    expect(paletteForRecord(10)).toEqual(paletteFor(10));
  });

  it('mask-mode R13 32 entries: the shared ten first, then 22 generated, labels 0 to 31 in order', () => {
    const palette = paletteForRecord(32);
    expect(palette).toHaveLength(32);
    expect(palette.map((entry) => entry.label)).toEqual(Array.from({ length: 32 }, (_, k) => k));
    expect(palette.slice(0, 10).map((entry) => entry.hex)).toEqual(PALETTE.map((entry) => entry.hex));
  });

  it('mask-mode R13 every colour is distinct and every pair is at least 15 apart in Lab', () => {
    const palette = paletteForRecord(32);
    expect(new Set(palette.map((entry) => entry.hex)).size).toBe(32);
    for (let i = 0; i < palette.length; i += 1) {
      for (let j = i + 1; j < palette.length; j += 1) {
        expect(deltaE76(lab(palette[i]!.hex), lab(palette[j]!.hex))).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it('mask-mode R13 the table is deterministic and a longer palette starts with the shorter one', () => {
    expect(paletteForRecord(32)).toEqual(paletteForRecord(32));
    expect(paletteForRecord(32).slice(0, 20)).toEqual(paletteForRecord(20));
  });

  it('mask-mode R13 hex is six upper-case digits and names are unique', () => {
    const palette = paletteForRecord(32);
    for (const entry of palette) expect(entry.hex).toMatch(/^#[0-9A-F]{6}$/);
    expect(new Set(palette.map((entry) => entry.name)).size).toBe(32);
  });

  it.each([0, 1, 33, 2.5])('mask-mode R13 %s entries is refused', (count) => {
    expect(() => paletteForRecord(count)).toThrow(RangeError);
  });
});
