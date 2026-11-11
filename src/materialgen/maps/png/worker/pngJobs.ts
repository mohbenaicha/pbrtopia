import { resampleToSquare } from '../../pixels/resampleToSquare';
import { decodePng, encodePng, PngError, PngTooLargeError, type DecodedPng, type PixelImage } from '../pngCodec';

/** The failure of a decode, as data: an Error class does not survive the trip from a worker. */
export interface PngDecodeFailure {
  ok: false;
  reason: 'too-large' | 'damaged';
  message: string;
}

/** Maps R60: the heavy PNG jobs, each with what it takes and what it gives. */
export interface PngJobs {
  encode: { input: { image: DecodedPng }; output: Uint8Array };
  decode: { input: { bytes: Uint8Array; maxSide: number }; output: { ok: true; image: DecodedPng } | PngDecodeFailure };
  /** Resamples to side x side (maps R27, R39) and encodes, so the large resampled picture never leaves the worker. */
  resizeEncode: { input: { image: PixelImage; side: number; normal: boolean }; output: Uint8Array };
}
export type PngJobKind = keyof PngJobs;

/** Maps R60: runs one PNG job. The worker and the in-page path both call this, so they cannot differ. */
export function runPngJob<K extends PngJobKind>(kind: K, input: PngJobs[K]['input']): PngJobs[K]['output'] {
  switch (kind) {
    case 'encode':
      return encodePng((input as PngJobs['encode']['input']).image) as PngJobs[K]['output'];
    case 'resizeEncode': {
      const { image, side, normal } = input as PngJobs['resizeEncode']['input'];
      return encodePng(resampleToSquare(image, side, { normal })) as PngJobs[K]['output'];
    }
    case 'decode': {
      const { bytes, maxSide } = input as PngJobs['decode']['input'];
      try {
        return { ok: true, image: decodePng(bytes, maxSide) } as PngJobs[K]['output'];
      } catch (error) {
        if (error instanceof PngTooLargeError) return { ok: false, reason: 'too-large', message: error.message } as PngJobs[K]['output'];
        if (error instanceof PngError) return { ok: false, reason: 'damaged', message: error.message } as PngJobs[K]['output'];
        throw error;
      }
    }
    default:
      throw new Error(`Unknown PNG job: ${String(kind)}`);
  }
}
