import { expandIndexed, isIndexedImage, PngError, PngTooLargeError, type PixelImage } from '../png/pngCodec';
import { decodePngOffThread } from '../png/pngOffThread';
import { MAX_DROP_SIDE } from './planDrop';

export type DecodeOutcome = { ok: true; image: PixelImage } | { ok: false; message: string };

/** Decodes a non-PNG image the way the browser does, to 8 bits without premultiplied alpha or colour conversion (maps R35). */
export type BitmapDecoder = (file: File) => Promise<PixelImage>;

/** The browser's decoder: no premultiplication and no colour-space conversion, read back through a canvas. */
export const decodeWithBrowser: BitmapDecoder = async (file) => {
  const bitmap = await createImageBitmap(file, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { colorSpace: 'srgb' });
    if (!context) throw new Error('No 2D canvas');
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: bitmap.width, height: bitmap.height, channels: 4, data: new Uint8Array(data.buffer.slice(0)) };
  } finally {
    bitmap.close();
  }
};

/**
 * R35, R40: PNG files go through the codec (so stored colours and alpha are exact); anything else, or a PNG the codec does not take
 * (interlaced), goes to the browser decoder. A file neither can read is "<name> is not an image".
 */
export async function decodeImageFile(file: File, browserDecode: BitmapDecoder = decodeWithBrowser): Promise<DecodeOutcome> {
  try {
    const decoded = await decodePngOffThread(new Uint8Array(await file.arrayBuffer()), MAX_DROP_SIDE); // maps R60
    return { ok: true, image: isIndexedImage(decoded) ? expandIndexed(decoded) : decoded };
  } catch (error) {
    if (error instanceof PngTooLargeError) return { ok: false, message: 'Image too large' };
    if (!(error instanceof PngError)) return { ok: false, message: `${file.name} is not an image` };
  }
  try {
    return { ok: true, image: await browserDecode(file) };
  } catch {
    return { ok: false, message: `${file.name} is not an image` };
  }
}
