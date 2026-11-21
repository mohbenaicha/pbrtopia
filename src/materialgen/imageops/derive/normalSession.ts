import type { EditValues } from '../filters/editControls';
import { downsampleBox } from '../filters/blendByCoverage';
import type { PixelImage } from '../gpu/pixelFormats';
import type { OpSession } from '../session/opSession';
import { startNormalJob, type NormalJobInput, type StartNormalJobOptions } from './normalJob';

// Normal-from-height R7, R10, R11: a normal-map session on a height working copy. No graphics context: each render is one worker job.

export interface NormalSessionOptions {
  image: PixelImage; // the height map, S x S
  previewSize?: number;
  /** Runs one job; tests give a fake. */
  startJob?: (input: NormalJobInput, options: StartNormalJobOptions) => Promise<PixelImage>;
}

const MAX_PREVIEW_SIZE = 1024;

export function createNormalSession({ image, previewSize, startJob = startNormalJob }: NormalSessionOptions): OpSession<EditValues> {
  const size = image.width;
  const factor = Math.max(1, Math.round(size / (previewSize ?? Math.min(size, MAX_PREVIEW_SIZE))));
  const preview = Math.floor(size / factor);
  const abort = new AbortController();
  let reduced: PixelImage | null = null; // the height at P, reduced once and kept for the session

  function render(source: () => PixelImage, values: EditValues): Promise<PixelImage> {
    if (abort.signal.aborted) return Promise.reject(new Error('The normal session is closed.'));
    return startJob({ image: source(), values }, { signal: abort.signal });
  }

  return {
    size,
    previewSize: preview,
    renderPreview: (values) => render(() => (reduced ??= downsampleBox(image, factor)), values),
    renderFinal: (values) => render(() => image, values),
    close: () => abort.abort(),
  };
}
