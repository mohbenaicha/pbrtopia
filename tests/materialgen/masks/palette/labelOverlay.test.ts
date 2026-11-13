import { describe, expect, it } from 'vitest';
import type { PixelImage } from '@mat/imageops';
import { paintLabelOverlay } from '@mat/masks/palette/labelOverlay';

const labels: PixelImage = { width: 2, height: 2, channels: 1, data: Uint8Array.from([0, 1, 1, 2]) };

describe('materialgen/masks paintLabelOverlay (imageops R80)', () => {
  it('R80 the pixels of the label are its palette colour at 0.75 strength; every other pixel is transparent', () => {
    const rgba = paintLabelOverlay(labels, 1, '#FF8000');
    expect(rgba.length).toBe(16);
    expect(Array.from(rgba.slice(4, 8))).toEqual([255, 128, 0, 191]); // pixel 1: label 1, alpha 0.75 x 255
    expect(Array.from(rgba.slice(8, 12))).toEqual([255, 128, 0, 191]);
    expect(Array.from(rgba.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(Array.from(rgba.slice(12, 16))).toEqual([0, 0, 0, 0]);
  });

  it('R80 a colour that is not a hex colour paints grey rather than failing', () => {
    const rgba = paintLabelOverlay(labels, 2, 'not a colour');
    expect(Array.from(rgba.slice(12, 16))).toEqual([128, 128, 128, 191]);
  });
});
