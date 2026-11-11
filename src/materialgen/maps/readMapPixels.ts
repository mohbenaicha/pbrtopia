import { expandIndexed, isIndexedImage, type PixelImage } from './png/pngCodec';
import { decodePngOffThread } from './png/pngOffThread';

/** Reads a stored map file as pixels; a file that is missing or will not decode is reported by the caller (maps R30, R61). */
export async function readMapPixels(blob: Blob | null): Promise<PixelImage | null> {
  if (blob === null) return null;
  try {
    const decoded = await decodePngOffThread(new Uint8Array(await blob.arrayBuffer())); // maps R60
    return isIndexedImage(decoded) ? expandIndexed(decoded) : decoded;
  } catch {
    return null;
  }
}
