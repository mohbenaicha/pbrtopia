import { describe, expect, it, vi } from 'vitest';
import { encodePng, type PixelImage } from '../../../../src/materialgen/maps/png/pngCodec';
import { writeChunk } from '../../../../src/materialgen/maps/png/pngChunks';
import { decodePngNative, type BrowserPngDecoder } from '../../../../src/materialgen/maps/png/decodePngNative';

const picture = (channels: 1 | 3 | 4, width = 4, height = 3): PixelImage => ({
  width, height, channels, data: Uint8Array.from({ length: width * height * channels }, (_, i) => (i * 7) & 255),
});
/** What the browser hands back: every pixel as RGBA, grey spread over red, green and blue. */
const rgbaOf = (image: PixelImage): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(image.width * image.height * 4);
  for (let i = 0; i < image.width * image.height; i += 1) {
    const c = image.channels;
    out[i * 4] = image.data[i * c]!;
    out[i * 4 + 1] = image.data[i * c + (c === 1 ? 0 : 1)]!;
    out[i * 4 + 2] = image.data[i * c + (c === 1 ? 0 : 2)]!;
    out[i * 4 + 3] = 255;
  }
  return out;
};
const browserFor = (image: PixelImage): BrowserPngDecoder => vi.fn(async () => ({ width: image.width, height: image.height, rgba: rgbaOf(image) }));

describe('materialgen/maps R60 decodePngNative', () => {
  it('R60 R59 an RGB PNG comes back as the same three-channel pixels the codec would give', async () => {
    const image = picture(3);
    const browser = browserFor(image);
    await expect(decodePngNative(encodePng(image), 8192, browser)).resolves.toEqual(image);
    expect(browser).toHaveBeenCalledOnce();
  });

  it('R60 R59 a grey PNG comes back as one channel', async () => {
    const image = picture(1);
    await expect(decodePngNative(encodePng(image), 8192, browserFor(image))).resolves.toEqual(image);
  });

  it('R60 R59 an RGBA PNG whose alpha is all 255 comes back as the same four-channel pixels', async () => {
    const image = picture(4);
    for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255;
    const opaque: BrowserPngDecoder = async () => ({ width: image.width, height: image.height, rgba: Uint8ClampedArray.from(image.data) });
    await expect(decodePngNative(encodePng(image), 8192, opaque)).resolves.toEqual(image);
  });

  it('R60 R59 an RGBA PNG with any alpha below 255 is left to the codec: the browser would premultiply it', async () => {
    const image = picture(4);
    for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255;
    image.data[7] = 128;
    const browser: BrowserPngDecoder = async () => ({ width: image.width, height: image.height, rgba: Uint8ClampedArray.from(image.data) });
    await expect(decodePngNative(encodePng(image), 8192, browser)).resolves.toBeNull();
  });

  it('R60 a PNG with a palette, 16 bits, interlacing or a transparency chunk is left to the codec, with the browser not asked', async () => {
    const browser = vi.fn(async () => ({ width: 4, height: 3, rgba: new Uint8ClampedArray(48) }));
    const rgb = encodePng(picture(3));
    const withHeader = (offset: number, value: number): Uint8Array => { const copy = rgb.slice(); copy[offset] = value; return copy; };
    const trns = (() => { // an RGB PNG with a tRNS chunk before its data
      const head = rgb.slice(0, 33);
      const rest = rgb.slice(33);
      return Uint8Array.from([...head, ...writeChunk('tRNS', Uint8Array.of(0, 0, 0, 0, 0, 0)), ...rest]);
    })();
    for (const bytes of [withHeader(25, 3), withHeader(24, 16), withHeader(28, 1), trns]) {
      await expect(decodePngNative(bytes, 8192, browser)).resolves.toBeNull();
    }
    expect(browser).not.toHaveBeenCalled();
  });

  it('R60 a side over the limit, and bytes that are not a PNG, are left to the codec, which reports them', async () => {
    const browser = browserFor(picture(3));
    await expect(decodePngNative(encodePng(picture(3)), 2, browser)).resolves.toBeNull();
    await expect(decodePngNative(new Uint8Array([1, 2, 3, 4]), 8192, browser)).resolves.toBeNull();
    expect(browser).not.toHaveBeenCalled();
  });

  it('R60 a browser that cannot decode the file, or answers with another size, leaves it to the codec', async () => {
    const image = picture(3);
    const failing: BrowserPngDecoder = async () => { throw new Error('no decoder'); };
    await expect(decodePngNative(encodePng(image), 8192, failing)).resolves.toBeNull();
    const wrong: BrowserPngDecoder = async () => ({ width: 9, height: 9, rgba: new Uint8ClampedArray(9 * 9 * 4) });
    await expect(decodePngNative(encodePng(image), 8192, wrong)).resolves.toBeNull();
  });
});
