import { describe, expect, it, vi } from 'vitest';
import { resizeToSquareBlob } from '../../../src/materialgen/maps/resizeToSquareBlob';
import { resampleToSquare } from '../../../src/materialgen/maps/pixels/resampleToSquare';
import { encodePng, type PixelImage } from '../../../src/materialgen/maps/png/pngCodec';

const picture = (width: number, height: number, channels: 3 | 4 = 3): PixelImage => ({
  width, height, channels, data: Uint8Array.from({ length: width * height * channels }, (_, i) => (i * 13) & 255),
});
const bytesOf = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer());

describe('materialgen/maps R27 resizeToSquareBlob: the graphics-card resizer', () => {
  it('R27 a picture that is not S x S is resampled by the resizer, which is told the map kind and S, and its result is the file', async () => {
    const result = picture(4, 4);
    const resize = vi.fn(async () => result);
    const blob = await resizeToSquareBlob(picture(8, 6), 'normal', 4, resize);
    expect(resize).toHaveBeenCalledWith(expect.objectContaining({ width: 8, height: 6 }), 'normal', 4);
    expect(await bytesOf(blob)).toEqual(encodePng(result));
  });

  it('R27 a picture that is already S x S is not resampled at all', async () => {
    const resize = vi.fn(async () => picture(4, 4));
    const image = picture(4, 4);
    const blob = await resizeToSquareBlob(image, 'albedo', 4, resize);
    expect(resize).not.toHaveBeenCalled();
    expect(await bytesOf(blob)).toEqual(encodePng(image));
  });

  it('R71 the S x S pixels are offered before the file is encoded: the resizer result, or the picture itself when it already is S x S', async () => {
    const result = picture(4, 4);
    const seen: PixelImage[] = [];
    const resize = vi.fn(async () => result);
    await resizeToSquareBlob(picture(8, 6), 'albedo', 4, resize, (pixels) => seen.push(pixels));
    const same = picture(4, 4);
    await resizeToSquareBlob(same, 'albedo', 4, undefined, (pixels) => seen.push(pixels));
    expect(seen).toEqual([result, same]);
    expect(seen[0]).toBe(result);
    expect(seen[1]).toBe(same);
  });

  it('R71 nothing is offered when the page-side rule does the resample (no resizer, or it failed)', async () => {
    const offer = vi.fn();
    await resizeToSquareBlob(picture(8, 6), 'albedo', 4, undefined, offer);
    await resizeToSquareBlob(picture(8, 6), 'albedo', 4, async () => { throw new Error('no graphics card'); }, offer);
    expect(offer).not.toHaveBeenCalled();
  });

  it('R27 when the resizer fails the page-side rule gives the file', async () => {
    const image = picture(8, 6);
    const blob = await resizeToSquareBlob(image, 'normal', 4, async () => { throw new Error('no graphics card'); });
    expect(await bytesOf(blob)).toEqual(encodePng(resampleToSquare(image, 4, { normal: true })));
  });

  it('R27 with no resizer the page-side rule gives the file', async () => {
    const image = picture(8, 6, 4);
    const blob = await resizeToSquareBlob(image, 'albedo', 4);
    expect(await bytesOf(blob)).toEqual(encodePng(resampleToSquare(image, 4, { normal: false })));
  });
});
