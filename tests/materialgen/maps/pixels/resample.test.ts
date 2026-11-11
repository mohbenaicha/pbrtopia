import { describe, expect, it } from 'vitest';
import { convertToSlotFormat } from '../../../../src/materialgen/maps/pixels/convertToSlotFormat';
import { resampleToSquare } from '../../../../src/materialgen/maps/pixels/resampleToSquare';
import type { PixelImage } from '../../../../src/materialgen/maps/png/pngCodec';

const image = (width: number, height: number, channels: 1 | 3 | 4, values: number[]): PixelImage => ({ width, height, channels, data: Uint8Array.from(values) });

describe('materialgen/maps R27 resampleToSquare', () => {
  it('R27 an image already S x S comes back unchanged', () => {
    const source = image(2, 2, 1, [1, 2, 3, 4]);
    expect(resampleToSquare(source, 2)).toEqual(source);
  });

  it('R27 R60 with nearest, label values are never blended: enlarging repeats them and reducing picks one', () => {
    const labels = image(2, 2, 1, [0, 1, 2, 3]);
    const up = resampleToSquare(labels, 4, { nearest: true });
    expect([...up.data]).toEqual([0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 3, 3, 2, 2, 3, 3]);
    const down = resampleToSquare(up, 2, { nearest: true });
    expect(new Set(down.data)).toEqual(new Set([0, 1, 2, 3]));
    expect(down.width).toBe(2);
  });

  it('R27 reduction averages the covered area', () => {
    expect(resampleToSquare(image(2, 2, 1, [0, 100, 200, 100]), 1).data).toEqual(Uint8Array.of(100));
    expect(resampleToSquare(image(4, 4, 1, Array.from({ length: 16 }, (_, i) => (i % 4 < 2 ? 0 : 200))), 2).data).toEqual(Uint8Array.of(0, 200, 0, 200));
  });

  it('R27 a reduction by a non-integer factor weights the partly covered source pixels', () => {
    // 3 -> 2 in x: each output covers 1.5 source pixels: (10*1 + 20*0.5)/1.5 = 13.33, (20*0.5 + 40*1)/1.5 = 33.33
    const out = resampleToSquare(image(3, 3, 1, [10, 20, 40, 10, 20, 40, 10, 20, 40]), 2);
    expect(Array.from(out.data)).toEqual([13, 33, 13, 33]);
  });

  it('R27 enlargement is bilinear and keeps the end pixels', () => {
    const out = resampleToSquare(image(2, 2, 1, [0, 100, 0, 100]), 4);
    expect(Array.from(out.data.subarray(0, 4))).toEqual([0, 25, 75, 100]);
    expect(out.width).toBe(4);
    expect(out.height).toBe(4);
  });

  it('R39 a non-square image is stretched to 1:1, each axis by its own factor', () => {
    const out = resampleToSquare(image(4, 2, 1, [0, 0, 100, 100, 0, 0, 100, 100]), 2);
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect(Array.from(out.data)).toEqual([0, 100, 0, 100]);
  });

  it('R27 every channel is resampled on its own and a flat image stays flat', () => {
    const flat = image(3, 5, 3, Array.from({ length: 45 }, (_, i) => [200, 50, 7][i % 3]!));
    const out = resampleToSquare(flat, 4);
    expect(Array.from(out.data.subarray(0, 3))).toEqual([200, 50, 7]);
    expect(new Set(Array.from(out.data).map((value, i) => `${i % 3}:${value}`)).size).toBe(3);
  });

  it('R27 alpha is resampled like a colour channel', () => {
    const out = resampleToSquare(image(2, 2, 4, [10, 20, 30, 0, 10, 20, 30, 255, 10, 20, 30, 0, 10, 20, 30, 255]), 1);
    expect(Array.from(out.data)).toEqual([10, 20, 30, 128]);
  });

  it('R27 a resampled normal map is renormalised so each vector is within 2% of unit length', () => {
    // Two opposing tilted normals average to a short vector; renormalising lifts it back to length one.
    const tiltedLeft = [Math.round((0.6 * 0.5 + 0.5) * 255), 128, Math.round((0.8 * 0.5 + 0.5) * 255)];
    const tiltedRight = [Math.round((-0.6 * 0.5 + 0.5) * 255), 128, Math.round((0.8 * 0.5 + 0.5) * 255)];
    const out = resampleToSquare(image(2, 1, 3, [...tiltedLeft, ...tiltedRight]), 1, { normal: true });
    const vector = Array.from(out.data).map((value) => (value / 255) * 2 - 1);
    expect(Math.hypot(...vector)).toBeGreaterThan(0.98);
    expect(Math.hypot(...vector)).toBeLessThan(1.02);
  });

  it('R27 a zero-length normal becomes straight up', () => {
    const out = resampleToSquare(image(2, 1, 3, [128, 128, 128, 128, 128, 128]), 1, { normal: true });
    expect(Array.from(out.data)).toEqual([128, 128, 255]);
  });
});

describe('materialgen/maps R35 convertToSlotFormat', () => {
  it('R35 alpha is dropped without multiplying it into the colour', () => {
    expect(convertToSlotFormat(image(1, 1, 4, [200, 100, 50, 10]), 'rgb')).toEqual(image(1, 1, 3, [200, 100, 50]));
  });

  it('R35 a grey source expands to RGB', () => {
    expect(convertToSlotFormat(image(2, 1, 1, [7, 9]), 'rgb')).toEqual(image(2, 1, 3, [7, 7, 7, 9, 9, 9]));
  });

  it('R35 a colour source becomes luminance with weights 0.2126, 0.7152, 0.0722 on the stored values', () => {
    expect(convertToSlotFormat(image(1, 1, 3, [255, 0, 0]), 'grey').data).toEqual(Uint8Array.of(54));
    expect(convertToSlotFormat(image(1, 1, 3, [0, 255, 0]), 'grey').data).toEqual(Uint8Array.of(182));
    expect(convertToSlotFormat(image(1, 1, 4, [0, 0, 255, 0]), 'grey').data).toEqual(Uint8Array.of(18));
    expect(convertToSlotFormat(image(1, 1, 3, [255, 255, 255]), 'grey').data).toEqual(Uint8Array.of(255));
  });

  it('R35 an image already in the slot format is returned as it is', () => {
    const grey = image(2, 1, 1, [1, 2]);
    expect(convertToSlotFormat(grey, 'grey')).toBe(grey);
  });
});
