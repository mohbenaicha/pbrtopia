import { describe, expect, it } from 'vitest';
import type { PixelImage } from '@mat/maps';
import { tileExportPicture } from '@mat/export/pixels/tileExportPicture';

const picture = (channels: 1 | 3): PixelImage => ({ width: 2, height: 2, channels, data: Uint8Array.from({ length: 4 * channels }, (_, index) => index + 1) });

describe('materialgen/export R46 repeating a picture', () => {
  it('R46 a 2 x 1 repeat is twice as wide with the same rows side by side', () => {
    const tiled = tileExportPicture(picture(1), 2, 1);
    expect([tiled.width, tiled.height, tiled.channels]).toEqual([4, 2, 1]);
    expect(Array.from(tiled.data)).toEqual([1, 2, 1, 2, 3, 4, 3, 4]);
  });

  it('R46 a 1 x 2 repeat is twice as high', () => {
    const tiled = tileExportPicture(picture(1), 1, 2);
    expect([tiled.width, tiled.height]).toEqual([2, 4]);
    expect(Array.from(tiled.data)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });

  it('R46 a 2 x 2 repeat holds four exact copies, in colour too', () => {
    const tiled = tileExportPicture(picture(3), 2, 2);
    expect([tiled.width, tiled.height, tiled.channels]).toEqual([4, 4, 3]);
    const row = (y: number): number[] => Array.from(tiled.data.slice(y * 12, y * 12 + 12));
    expect(row(0)).toEqual([1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]);
    expect(row(1)).toEqual([7, 8, 9, 10, 11, 12, 7, 8, 9, 10, 11, 12]);
    expect(row(2)).toEqual(row(0));
    expect(row(3)).toEqual(row(1));
  });

  it('R46 1 x 1 returns the picture itself and the source is never changed', () => {
    const source = picture(1);
    expect(tileExportPicture(source, 1, 1)).toBe(source);
    const before = Array.from(source.data);
    tileExportPicture(source, 3, 3);
    expect(Array.from(source.data)).toEqual(before);
  });
});
