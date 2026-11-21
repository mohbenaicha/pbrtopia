import { describe, expect, it } from 'vitest';
import { deltaE76, hexToRgb, rgbToLab } from '@shared/materialMasks/color/lab';
import { PALETTE, paletteFor } from '@shared/materialMasks/palette/palette';

const lab = (hex: string) => rgbToLab(...hexToRgb(hex));

describe('materialgen/masks palette', () => {
  it('R9 the palette has 10 entries whose pairwise delta E is at least 30', () => {
    expect(PALETTE).toHaveLength(10);
    for (let i = 0; i < PALETTE.length; i += 1) {
      for (let j = i + 1; j < PALETTE.length; j += 1) {
        expect(deltaE76(lab(PALETTE[i]!.hex), lab(PALETTE[j]!.hex))).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it('R9 every name is a unique plain lower-case colour word and every hex is six digits', () => {
    const names = PALETTE.map((entry) => entry.name);
    expect(new Set(names).size).toBe(10);
    for (const entry of PALETTE) {
      expect(entry.name).toMatch(/^[a-z]+$/);
      expect(entry.hex).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('R10 N components use entries 0 to N-1 in order, as label, hex and name', () => {
    const used = paletteFor(3);
    expect(used).toEqual([0, 1, 2].map((label) => ({ label, hex: PALETTE[label]!.hex, name: PALETTE[label]!.name })));
  });

  it('R10 a count outside 1 to 10 is refused', () => {
    expect(() => paletteFor(0)).toThrow(RangeError);
    expect(() => paletteFor(11)).toThrow(RangeError);
    expect(paletteFor(10)).toHaveLength(10);
  });
});
