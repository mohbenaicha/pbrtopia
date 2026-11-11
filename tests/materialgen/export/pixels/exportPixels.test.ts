import { describe, expect, it } from 'vitest';
import { flipNormalGreen, labelsToPaletteRgb, packOrmPixels, resampleLabelsNearest, resampleMapForExport } from '@mat/export';
import type { PixelImage } from '@mat/maps';

const rgb = (width: number, height: number, bytes: number[]): PixelImage => ({ width, height, channels: 3, data: Uint8Array.from(bytes) });
const grey = (width: number, height: number, bytes: number[]): PixelImage => ({ width, height, channels: 1, data: Uint8Array.from(bytes) });

describe('materialgen/export R11 normal flip', () => {
  it('R11 green becomes 255 - g, red and blue are untouched', () => {
    const flipped = flipNormalGreen(rgb(2, 1, [10, 20, 30, 40, 250, 60]));
    expect(Array.from(flipped.data)).toEqual([10, 235, 30, 40, 5, 60]);
  });

  it('R11 flipping twice returns the stored bytes, and the input is not changed', () => {
    const stored = rgb(2, 1, [1, 2, 3, 4, 5, 6]);
    const copy = Uint8Array.from(stored.data);
    expect(Array.from(flipNormalGreen(flipNormalGreen(stored)).data)).toEqual(Array.from(copy));
    expect(Array.from(stored.data)).toEqual(Array.from(copy));
  });
});

describe('materialgen/export R8 packed ORM', () => {
  const a = grey(2, 1, [10, 20]);
  const r = grey(2, 1, [30, 40]);
  const m = grey(2, 1, [50, 60]);

  it('R8 R = ao, G = roughness, B = metallic, as an RGB picture', () => {
    const packed = packOrmPixels({ ao: a, rough: r, metal: m });
    expect(packed?.channels).toBe(3);
    expect(Array.from(packed!.data)).toEqual([10, 30, 50, 20, 40, 60]);
  });

  it('R8 a missing ao gives 255, a missing metallic 0 and a missing roughness 128', () => {
    expect(Array.from(packOrmPixels({ rough: r })!.data)).toEqual([255, 30, 0, 255, 40, 0]);
    expect(Array.from(packOrmPixels({ metal: m })!.data)).toEqual([255, 128, 50, 255, 128, 60]);
    expect(Array.from(packOrmPixels({ ao: a })!.data)).toEqual([10, 128, 0, 20, 128, 0]);
  });

  it('R8 with all three missing there is no pack', () => {
    expect(packOrmPixels({})).toBeNull();
  });

  it('R8 a map that is not grey is read by its red channel', () => {
    const colour = rgb(2, 1, [7, 0, 0, 9, 0, 0]);
    expect(Array.from(packOrmPixels({ rough: colour })!.data)).toEqual([255, 7, 0, 255, 9, 0]);
  });
});

describe('materialgen/export R22 R23 size and labels', () => {
  it('R22 a smaller size averages the pixels (grey maps)', () => {
    const half = resampleMapForExport(grey(2, 2, [0, 100, 100, 200]), 1, false);
    expect(Array.from(half.data)).toEqual([100]);
  });

  it('R22 a normal map is made unit length again after resampling', () => {
    const left = [255, 128, 128]; // roughly +x
    const up = [128, 255, 128]; // roughly +y
    const small = resampleMapForExport(rgb(2, 1, [...left, ...up]), 1, true);
    const [x, y, z] = Array.from(small.data).map((byte) => (byte / 255) * 2 - 1);
    expect(Math.hypot(x!, y!, z!)).toBeGreaterThan(0.97);
    expect(Math.hypot(x!, y!, z!)).toBeLessThan(1.03);
  });

  it('R22 the same size returns the picture as it is', () => {
    const picture = grey(2, 2, [1, 2, 3, 4]);
    expect(resampleMapForExport(picture, 2, false)).toBe(picture);
  });

  it('R23 labels are resampled by nearest neighbour, never averaged', () => {
    const labels = grey(4, 4, [0, 0, 5, 5, 0, 0, 5, 5, 3, 3, 9, 9, 3, 3, 9, 9]);
    const small = resampleLabelsNearest(labels, 2);
    expect(Array.from(small.data)).toEqual([0, 5, 3, 9]);
  });

  it('R23 each label pixel is written in its palette colour; a label the palette lacks is black', () => {
    const labels = grey(3, 1, [0, 1, 7]);
    const picture = labelsToPaletteRgb(labels, [{ label: 0, hex: '#FF0000' }, { label: 1, hex: '#00FF80' }]);
    expect(picture.channels).toBe(3);
    expect(Array.from(picture.data)).toEqual([255, 0, 0, 0, 255, 128, 0, 0, 0]);
  });
});
