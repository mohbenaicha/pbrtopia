import { describe, expect, it } from 'vitest';
import type { PixelImage } from '@mat/imageops';
import { blendByCoverage, downsampleBox } from '@mat/imageops/filters/blendByCoverage';

const image = (width: number, channels: 1 | 3, values: number[]): PixelImage => ({ width, height: values.length / (width * channels), channels, data: Uint8Array.from(values) });
const plane = (width: number, values: number[]): PixelImage => image(width, 1, values);

describe('materialgen/imageops blendByCoverage (R79)', () => {
  it('R79 where coverage is 0 the result is the original bytes, exactly; where it is 255 it is the filtered bytes', () => {
    const original = image(2, 1, [10, 20, 30, 40]);
    const filtered = image(2, 1, [200, 210, 220, 230]);
    const result = blendByCoverage(original, filtered, plane(2, [0, 255, 0, 255]));
    expect(Array.from(result.data)).toEqual([10, 210, 30, 230]);
  });

  it('R79 a partial coverage is the rounded mix on every channel', () => {
    const original = image(1, 3, [0, 100, 200]);
    const filtered = image(1, 3, [100, 200, 0]);
    const result = blendByCoverage(original, filtered, plane(1, [128]));
    expect(Array.from(result.data)).toEqual([50, 150, 100]); // 128/255 = 0.502
  });

  it('R79 the result has the original\'s size and channels, and neither input is changed', () => {
    const original = image(2, 3, [1, 2, 3, 4, 5, 6]);
    const filtered = image(2, 3, [9, 9, 9, 9, 9, 9]);
    const result = blendByCoverage(original, filtered, plane(2, [255, 0]));
    expect(result).toMatchObject({ width: 2, height: 1, channels: 3 });
    expect(Array.from(original.data)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(Array.from(filtered.data)).toEqual([9, 9, 9, 9, 9, 9]);
  });

  it('R79 pictures of different sizes cannot be blended', () => {
    expect(() => blendByCoverage(image(2, 1, [1, 2]), image(1, 1, [1]), plane(2, [0, 0]))).toThrow();
  });
});

describe('materialgen/imageops downsampleBox (R79)', () => {
  it('R79 a factor of 2 averages each 2 x 2 block (what a linear resample of the graphics card gives)', () => {
    const source = image(2, 1, [10, 20, 30, 40]); // 2 x 2
    expect(Array.from(downsampleBox(source, 2).data)).toEqual([25]);
  });

  it('R79 a factor of 1 returns the picture itself', () => {
    const source = image(2, 1, [1, 2, 3, 4]);
    expect(downsampleBox(source, 1)).toBe(source);
  });

  it('R79 keeps the channels', () => {
    const source = image(2, 3, [0, 0, 0, 4, 4, 4, 8, 8, 8, 12, 12, 12]); // 2 x 2 x 3
    expect(Array.from(downsampleBox(source, 2).data)).toEqual([6, 6, 6]);
  });
});
