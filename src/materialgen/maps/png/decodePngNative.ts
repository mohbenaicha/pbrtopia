import type { PixelImage } from './pngCodec';

/** The browser's own decode of a PNG: every pixel as RGBA, with no premultiplication and no colour conversion. */
export type BrowserPngDecoder = (bytes: Uint8Array) => Promise<{ width: number; height: number; rgba: Uint8ClampedArray }>;

export const decodeWithBrowserApi: BrowserPngDecoder = async (bytes) => {
  if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') throw new Error('No browser decoder');
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/png' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  try {
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d', { colorSpace: 'srgb', alpha: false, willReadFrequently: true });
    if (context === null) throw new Error('No 2D canvas');
    context.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, rgba: context.getImageData(0, 0, bitmap.width, bitmap.height).data };
  } finally {
    bitmap.close();
  }
};

const HEADER_END = 33; // 8 signature bytes, then the 25 bytes of the header chunk
const NATIVE_COLOR_TYPES = new Map<number, 1 | 3 | 4>([[0, 1], [2, 3], [6, 4]]); // grey, RGB and RGBA (kept only when every alpha is 255)

/** The channel count the browser may decode for these bytes, or null when the codec must (alpha, palette, other bit depth, interlacing, a transparency chunk, a side over the limit). */
function nativeChannelsOf(bytes: Uint8Array, maxSide: number): { channels: 1 | 3 | 4; width: number; height: number } | null {
  if (bytes.length < HEADER_END || bytes[0] !== 137 || bytes[1] !== 80) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const channels = NATIVE_COLOR_TYPES.get(bytes[25]!);
  if (channels === undefined || bytes[24] !== 8 || bytes[28] !== 0 || Math.max(width, height) > maxSide) return null;
  for (let at = HEADER_END; at + 8 <= bytes.length; ) {
    const type = String.fromCharCode(bytes[at + 4]!, bytes[at + 5]!, bytes[at + 6]!, bytes[at + 7]!);
    if (type === 'tRNS') return null;
    if (type === 'IDAT') break; // a transparency chunk comes before the data
    at += 12 + view.getUint32(at);
  }
  return { channels, width, height };
}

/**
 * Maps R60: a large 8-bit grey or RGB PNG decoded by the browser, which gives the codec's values (R59) in a fraction of the time. Null when the codec must
 * decode it instead: another kind of PNG, a side over `maxSide`, bytes that are no PNG, or a browser that cannot decode it.
 */
export async function decodePngNative(bytes: Uint8Array, maxSide: number, decode: BrowserPngDecoder = decodeWithBrowserApi): Promise<PixelImage | null> {
  const plan = nativeChannelsOf(bytes, maxSide);
  if (plan === null) return null;
  try {
    const { width, height, rgba } = await decode(bytes);
    if (width !== plan.width || height !== plan.height) return null;
    const count = width * height;
    const data = new Uint8Array(count * plan.channels);
    if (plan.channels === 4) {
      for (let at = 3; at < data.length; at += 4) if (rgba[at] !== 255) return null; // the browser premultiplied it: the codec decodes it exactly
      data.set(rgba);
    } else if (plan.channels === 1) for (let i = 0, from = 0; i < count; i += 1, from += 4) data[i] = rgba[from]!;
    else for (let i = 0, from = 0, o = 0; i < count; i += 1, from += 4, o += 3) {
      data[o] = rgba[from]!;
      data[o + 1] = rgba[from + 1]!;
      data[o + 2] = rgba[from + 2]!;
    }
    return { width, height, channels: plan.channels, data };
  } catch {
    return null;
  }
}
