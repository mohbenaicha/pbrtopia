import type { DecodeOutcome } from './decodeImageFile';
import type { PixelImage } from '../png/pngCodec';

export type PickOutcome = { ok: true; image: PixelImage; fileName: string; notice: string | null } | { ok: false; message: string };

/**
 * R40, R41: the first file that decodes is used; the others are ignored and counted in a notice. Files that are not images are skipped
 * silently when one is used; when none is, the first file is named in the refusal.
 */
export async function pickDroppedImage(files: readonly File[], decode: (file: File) => Promise<DecodeOutcome>): Promise<PickOutcome> {
  if (files.length === 0) return { ok: false, message: 'Drop an image file.' };
  let firstRefusal: string | null = null;
  for (const [index, file] of files.entries()) {
    const outcome = await decode(file);
    if (!outcome.ok) {
      firstRefusal ??= outcome.message;
      continue;
    }
    const ignored = files.length - index - 1; // the files after the used one are not even read; earlier non-images were skipped silently
    return { ok: true, image: outcome.image, fileName: file.name, notice: ignored > 0 ? `Used ${file.name}; ${ignored} other file(s) ignored.` : null };
  }
  return { ok: false, message: firstRefusal ?? 'Drop an image file.' };
}
