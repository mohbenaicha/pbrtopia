import { startWorkerJob, type WorkerJobHandle } from '@shared/workerJob';
import type { EditValues } from '../filters/editControls';
import type { PixelImage } from '../gpu/pixelFormats';
import { computeNormalFromHeight } from './normalFromHeight';

/** Normal-from-height R10: one normal-map computation, run off the main thread. */
export interface NormalJobInput {
  image: PixelImage;
  values: EditValues;
}

export interface StartNormalJobOptions {
  /** Makes the worker; undefined runs the work in the page. Tests give a fake or undefined. */
  createWorker?: (() => WorkerJobHandle) | undefined;
  /** Cancelling ends the worker at once and rejects with an AbortError. */
  signal?: AbortSignal | undefined;
}

const createNormalWorker = (): WorkerJobHandle => new Worker(new URL('./normalWorker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerJobHandle;

/** The work of the job; the worker and the in-page fallback both call this, so they cannot differ. */
export const runNormalJob = ({ image, values }: NormalJobInput): PixelImage => computeNormalFromHeight(image, values);

/** Runs the job in a fresh worker, or in the page where workers do not exist (the rules of `startWorkerJob`). */
export function startNormalJob(input: NormalJobInput, options: StartNormalJobOptions = {}): Promise<PixelImage> {
  const { createWorker = typeof Worker === 'undefined' ? undefined : createNormalWorker, signal } = options;
  return startWorkerJob<PixelImage>({ kind: 'normal', input }, { createWorker, runInPage: () => runNormalJob(input), signal });
}
