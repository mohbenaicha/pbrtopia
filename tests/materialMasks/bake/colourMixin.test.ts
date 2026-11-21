import { describe, expect, it } from 'vitest';
import type { PixelImage } from '@shared/materialMasks';
import { albedoToGrey, meanGreyPerRow } from '@shared/materialMasks/bake/colourMixin';

describe('materialgen/masks colour mixin helpers (R91 R96)', () => {
  it('R91 the grey of an RGB or RGBA albedo is its BT.709 weighting of the stored bytes, one channel at the same size', () => {
    const rgb: PixelImage = { width: 2, height: 1, channels: 3, data: Uint8Array.from([255, 0, 0, 100, 100, 100]) };
    const grey = albedoToGrey(rgb);
    expect([grey.width, grey.height, grey.channels]).toEqual([2, 1, 1]);
    expect(Array.from(grey.data)).toEqual([54, 100]);
    const rgba: PixelImage = { width: 1, height: 1, channels: 4, data: Uint8Array.from([0, 255, 0, 7]) };
    expect(Array.from(albedoToGrey(rgba).data)).toEqual([182]);
  });

  it('R91 a grey albedo is returned as it is', () => {
    const grey: PixelImage = { width: 2, height: 1, channels: 1, data: Uint8Array.from([5, 6]) };
    expect(albedoToGrey(grey)).toBe(grey);
  });

  it('R91 the mean is taken for the rows that have the mixin only, over the pixels of their label', () => {
    const labels: PixelImage = { width: 4, height: 1, channels: 1, data: Uint8Array.from([0, 0, 1, 1]) };
    const grey: PixelImage = { width: 4, height: 1, channels: 1, data: Uint8Array.from([100, 200, 10, 30]) };
    const means = meanGreyPerRow(labels, grey, [{ invert: false, rough: 1, metal: 1 }, undefined]);
    expect(Array.from(means)).toEqual([150, 0]);
  });
});
