import { startWorkerJob, type WorkerJobHandle } from '@shared/workerJob';
import { runPngJob, type PngJobKind, type PngJobs } from './pngJobs';

export interface StartPngJobOptions {
  createWorker?: () => WorkerJobHandle;
}

const createPngWorker = (): WorkerJobHandle => new Worker(new URL('./pngWorker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerJobHandle;

/**
 * Maps R60: runs one PNG job in a fresh worker so a large map does not hold up the page. The input is copied, so the caller keeps its picture; where
 * workers do not exist the job runs in the page by the same function.
 */
export function startPngJob<K extends PngJobKind>(kind: K, input: PngJobs[K]['input'], options: StartPngJobOptions = {}): Promise<PngJobs[K]['output']> {
  const { createWorker = typeof Worker === 'undefined' ? undefined : createPngWorker } = options;
  return startWorkerJob<PngJobs[K]['output']>({ kind, input }, { createWorker, runInPage: () => runPngJob(kind, input) });
}
