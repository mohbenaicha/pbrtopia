import { describe, expect, it } from 'vitest';
import { decodeImageFile, type BitmapDecoder } from '../../../../src/materialgen/maps/drop/decodeImageFile';
import { pickDroppedImage } from '../../../../src/materialgen/maps/drop/pickDroppedImage';
import { encodePng, type PixelImage } from '../../../../src/materialgen/maps/png/pngCodec';

const pixels: PixelImage = { width: 2, height: 1, channels: 3, data: Uint8Array.of(1, 2, 3, 4, 5, 6) };
const pngFile = (name: string): File => new File([encodePng(pixels) as BlobPart], name, { type: 'image/png' });
const textFile = (name: string): File => new File(['hello'], name, { type: 'text/plain' });
const bitmapOf = (image: PixelImage): BitmapDecoder => async () => image;

describe('materialgen/maps R35 R40 decodeImageFile', () => {
  it('R35 a PNG is decoded by the codec, not the browser, so alpha stays as stored', async () => {
    const rgba: PixelImage = { width: 1, height: 1, channels: 4, data: Uint8Array.of(9, 8, 7, 3) };
    const file = new File([encodePng(rgba) as BlobPart], 'a.png', { type: 'image/png' });
    const decoded = await decodeImageFile(file, async () => Promise.reject(new Error('must not be used')));
    expect(decoded).toEqual({ ok: true, image: rgba });
  });

  it('R35 another image type goes to the browser decoder', async () => {
    const jpeg = new File([new Uint8Array([255, 216, 255])], 'a.jpg', { type: 'image/jpeg' });
    expect(await decodeImageFile(jpeg, bitmapOf(pixels))).toEqual({ ok: true, image: pixels });
  });

  it('R35 an interlaced or unsupported PNG falls back to the browser decoder', async () => {
    const broken = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0])], 'x.png', { type: 'image/png' });
    expect(await decodeImageFile(broken, bitmapOf(pixels))).toEqual({ ok: true, image: pixels });
  });

  it('R40 a file the browser cannot decode is "<name> is not an image"', async () => {
    const outcome = await decodeImageFile(textFile('notes.txt'), async () => Promise.reject(new Error('no')));
    expect(outcome).toEqual({ ok: false, message: 'notes.txt is not an image' });
  });
});

describe('materialgen/maps R41 pickDroppedImage', () => {
  const decode = (file: File) => decodeImageFile(file, async () => Promise.reject(new Error('no')));

  it('R41 uses the first decodable image and says how many other files were ignored', async () => {
    const outcome = await pickDroppedImage([pngFile('a.png'), pngFile('b.png'), pngFile('c.png')], decode);
    expect(outcome).toMatchObject({ ok: true, fileName: 'a.png', notice: 'Used a.png; 2 other file(s) ignored.' });
  });

  it('R41 files that are not images are skipped silently when an image is used', async () => {
    const outcome = await pickDroppedImage([textFile('readme.txt'), pngFile('b.png')], decode);
    expect(outcome).toMatchObject({ ok: true, fileName: 'b.png' });
    expect(outcome.ok && outcome.notice).toBeNull();
  });

  it('R41 a single file produces no notice', async () => {
    const outcome = await pickDroppedImage([pngFile('a.png')], decode);
    expect(outcome.ok && outcome.notice).toBeNull();
  });

  it('R40 when no file is an image the first file is named in the refusal', async () => {
    const outcome = await pickDroppedImage([textFile('readme.txt'), textFile('b.txt')], decode);
    expect(outcome).toEqual({ ok: false, message: 'readme.txt is not an image' });
  });

  it('R40 an empty drop is refused with a plain sentence', async () => {
    expect(await pickDroppedImage([], decode)).toEqual({ ok: false, message: 'Drop an image file.' });
  });
});
