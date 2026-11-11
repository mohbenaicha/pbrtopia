import { zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { PNG_SIGNATURE, writeChunk } from '../../../../src/materialgen/maps/png/pngChunks';
import { decodePng, encodePng, expandIndexed, isIndexedImage, PngError, type PixelImage } from '../../../../src/materialgen/maps/png/pngCodec';

function filled(width: number, height: number, channels: 1 | 3 | 4, valueAt: (index: number) => number): PixelImage {
  const data = new Uint8Array(width * height * channels);
  for (let index = 0; index < data.length; index += 1) data[index] = valueAt(index);
  return { width, height, channels, data };
}

/** A PNG built by hand with filter 0 on every row, for the inputs the encoder never writes. */
function rawPng(width: number, height: number, bitDepth: number, colorType: number, rows: number[][], extra: Uint8Array[] = [], interlace = 0): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([bitDepth, colorType, 0, 0, interlace], 8);
  const scanlines = rows.flatMap((row) => [0, ...row]);
  const parts = [PNG_SIGNATURE, writeChunk('IHDR', header), ...extra, writeChunk('IDAT', zlibSync(Uint8Array.from(scanlines))), writeChunk('IEND', new Uint8Array())];
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

describe('materialgen/maps R58 R59 PNG round trip', () => {
  it('R59 8-bit RGB returns every value', () => {
    const image = filled(7, 5, 3, (index) => (index * 37 + 11) % 256);
    expect(decodePng(encodePng(image))).toEqual(image);
  });

  it('R59 8-bit RGBA keeps alpha below 255 and the colour under it, with no premultiplication', () => {
    const image = filled(6, 6, 4, (index) => (index % 4 === 3 ? (index * 5) % 256 : (index * 53 + 7) % 256));
    expect(decodePng(encodePng(image))).toEqual(image);
  });

  it('R59 8-bit grey returns all 256 values', () => {
    const image = filled(16, 16, 1, (index) => index);
    expect(decodePng(encodePng(image))).toEqual(image);
  });

  it('R58 R59 8-bit indexed returns the palette and every index', () => {
    const palette = Uint8Array.from([10, 20, 30, 200, 100, 50, 255, 255, 255]);
    const image = { width: 4, height: 3, palette, indices: Uint8Array.from([0, 1, 2, 0, 1, 2, 0, 1, 2, 2, 1, 0]) };
    const decoded = decodePng(encodePng(image));
    expect(isIndexedImage(decoded)).toBe(true);
    expect(decoded).toEqual(image);
  });

  it('R59 a larger noisy image survives every row filter the encoder may pick', () => {
    let seed = 7;
    const next = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 16) & 255;
    const image = filled(64, 48, 3, () => next());
    expect(decodePng(encodePng(image))).toEqual(image);
    const smooth = filled(64, 48, 3, (index) => Math.floor(index / 30) % 256);
    expect(decodePng(encodePng(smooth))).toEqual(smooth);
  });

  it('R58 the encoder writes colour types 0, 2, 3 and 6', () => {
    const typeOf = (bytes: Uint8Array): number => bytes[25]!;
    expect(typeOf(encodePng(filled(2, 2, 1, () => 1)))).toBe(0);
    expect(typeOf(encodePng(filled(2, 2, 3, () => 1)))).toBe(2);
    expect(typeOf(encodePng(filled(2, 2, 4, () => 1)))).toBe(6);
    expect(typeOf(encodePng({ width: 1, height: 1, palette: Uint8Array.of(0, 0, 0), indices: Uint8Array.of(0) }))).toBe(3);
  });
});

describe('materialgen/maps R35 decoding of dropped PNG files', () => {
  it('R35 a 16-bit RGB source is reduced to 8 bits by its high byte', () => {
    const bytes = rawPng(2, 1, 16, 2, [[0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xff, 0xff, 0x00, 0x01, 0x80, 0x00]]);
    expect(decodePng(bytes)).toEqual({ width: 2, height: 1, channels: 3, data: Uint8Array.of(0x12, 0x56, 0x9a, 0xff, 0x00, 0x80) });
  });

  it('R35 a grey source with alpha comes out as RGBA (the grey repeated)', () => {
    const bytes = rawPng(2, 1, 8, 4, [[50, 255, 200, 10]]);
    expect(decodePng(bytes)).toEqual({ width: 2, height: 1, channels: 4, data: Uint8Array.of(50, 50, 50, 255, 200, 200, 200, 10) });
  });

  it('R35 a 4-bit grey source is expanded to the full 8-bit range', () => {
    const bytes = rawPng(2, 1, 4, 0, [[0x0f]]);
    expect(decodePng(bytes)).toEqual({ width: 2, height: 1, channels: 1, data: Uint8Array.of(0, 255) });
  });

  it('R35 a palette PNG expands to RGB with expandIndexed', () => {
    const plte = writeChunk('PLTE', Uint8Array.of(1, 2, 3, 4, 5, 6));
    const decoded = decodePng(rawPng(2, 1, 8, 3, [[1, 0]], [plte]));
    expect(isIndexedImage(decoded)).toBe(true);
    if (isIndexedImage(decoded)) expect(expandIndexed(decoded)).toEqual({ width: 2, height: 1, channels: 3, data: Uint8Array.of(4, 5, 6, 1, 2, 3) });
  });
});

describe('materialgen/maps R61 PNG decode failures', () => {
  it('R61 a file that is not a PNG is refused', () => {
    expect(() => decodePng(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8, 9))).toThrow(PngError);
  });

  it('R61 a flipped byte inside a chunk fails the checksum', () => {
    const bytes = encodePng(filled(4, 4, 3, (index) => index));
    bytes[bytes.length - 20] = (bytes[bytes.length - 20]! + 1) & 255;
    expect(() => decodePng(bytes)).toThrow(PngError);
  });

  it('R61 a file cut short is refused', () => {
    const bytes = encodePng(filled(4, 4, 3, (index) => index));
    expect(() => decodePng(bytes.slice(0, bytes.length - 30))).toThrow(PngError);
  });

  it('R61 an interlaced PNG is refused so the caller can decode it another way', () => {
    expect(() => decodePng(rawPng(1, 1, 8, 0, [[0]], [], 1))).toThrow(/interlaced/i);
  });

  it('R61 pixel data that is too short for the header is refused', () => {
    expect(() => decodePng(rawPng(4, 4, 8, 2, [[0, 0, 0]]))).toThrow(PngError);
  });
});
