import { decodePng, PngError, PngTooLargeError, type DecodedPng, type PixelImage } from './pngCodec';
import { decodePngNative } from './decodePngNative';
import { runPngJob } from './worker/pngJobs';
import { startPngJob, type StartPngJobOptions } from './worker/startPngJob';

/** Maps R60: a picture of more pixels than 512 x 512 is encoded and decoded in a worker; smaller ones are quicker done in the page. */
export const OFF_THREAD_PIXELS = 512 * 512;

const IHDR_WIDTH_AT = 16; // 8 signature bytes, then the length and the name of the header chunk

/** The pixel count a PNG header names, or null when the bytes do not start like a PNG (the decoder then says what is wrong). */
function peekPixelCount(bytes: Uint8Array): number | null {
  if (bytes.length < IHDR_WIDTH_AT + 8 || bytes[0] !== 137 || bytes[1] !== 80) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(IHDR_WIDTH_AT) * view.getUint32(IHDR_WIDTH_AT + 4);
}

/** Maps R60: the PNG file of a picture as a Blob, encoded off the page's thread when the picture is large. */
export async function encodePngBlob(image: DecodedPng, options: StartPngJobOptions = {}): Promise<Blob> {
  const large = image.width * image.height > OFF_THREAD_PIXELS;
  const bytes = large ? await startPngJob('encode', { image }, options) : runPngJob('encode', { image });
  return new Blob([bytes as BlobPart], { type: 'image/png' });
}

/** Maps R60: the picture resampled to side x side and encoded as a Blob, in one worker job when the source or the result is large. */
export async function encodeResizedPngBlob(image: PixelImage, side: number, resample: { normal: boolean }, options: StartPngJobOptions = {}): Promise<Blob> {
  const large = Math.max(image.width * image.height, side * side) > OFF_THREAD_PIXELS;
  const input = { image, side, normal: resample.normal };
  const bytes = large ? await startPngJob('resizeEncode', input, options) : runPngJob('resizeEncode', input);
  return new Blob([bytes as BlobPart], { type: 'image/png' });
}

/**
 * Maps R60: decodes a PNG, off the page's thread when its header names a large picture. Fails like `decodePng`: PngTooLargeError for a side over
 * `maxSide`, PngError for a damaged or unsupported file.
 */
export async function decodePngOffThread(bytes: Uint8Array, maxSide = Number.POSITIVE_INFINITY, options: StartPngJobOptions = {}): Promise<DecodedPng> {
  const pixels = peekPixelCount(bytes);
  if (pixels === null || pixels <= OFF_THREAD_PIXELS) return decodePng(bytes, maxSide);
  const native = await decodePngNative(bytes, maxSide);
  if (native !== null) return native;
  const outcome = await startPngJob('decode', { bytes, maxSide }, options);
  if (outcome.ok) return outcome.image;
  throw outcome.reason === 'too-large' ? new PngTooLargeError(outcome.message) : new PngError(outcome.message);
}
