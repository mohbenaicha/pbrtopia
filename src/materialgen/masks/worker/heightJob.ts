import { rowsToHeightOffsets, type MasksRecord, type PixelImage } from '@shared/materialMasks';
import { startWorkerJob, type WorkerJobHandle } from '@shared/workerJob';
import { bakeHeight } from '../bake/bakeHeight';

/** Masks R82: the Height map under the record's height offsets, from the base the caller names (R83). Height is material gen's alone, so the job lives here, not in the mask core. */
export interface HeightJobInput {
  labels: PixelImage;
  record: MasksRecord;
  base: PixelImage;
}

/** Masks R24, R82: runs the height job. The worker and the in-page fallback both call this, so they cannot differ. */
export function runHeightJob({ labels, record, base }: HeightJobInput): PixelImage {
  return bakeHeight({ labels, offsets: rowsToHeightOffsets(record.rows), feather: record.feather, base });
}

export interface StartHeightJobOptions {
  createWorker?: () => WorkerJobHandle;
  /** Cancelling ends the worker at once and rejects with an AbortError. */
  signal?: AbortSignal;
}

const createHeightWorker = (): WorkerJobHandle => new Worker(new URL('./heightWorker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerJobHandle;

/** Masks R24, R82: runs the height job in a fresh worker, or in the page where workers do not exist (the rules of `startWorkerJob`). */
export function startHeightJob(input: HeightJobInput, options: StartHeightJobOptions = {}): Promise<PixelImage> {
  const { createWorker = typeof Worker === 'undefined' ? undefined : createHeightWorker, signal } = options;
  return startWorkerJob<PixelImage>({ kind: 'height', input }, { createWorker, runInPage: () => runHeightJob(input), signal });
}
