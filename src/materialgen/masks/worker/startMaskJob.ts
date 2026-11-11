import { startWorkerJob, type WorkerJobHandle } from '@mat/workerjob';
import { runMaskJob, type MaskJobKind, type MaskJobs } from './maskJobs';

/** The part of a Worker a masks job uses; tests give a fake. */
export type MaskWorkerLike = WorkerJobHandle;

export interface StartMaskJobOptions {
  createWorker?: () => MaskWorkerLike;
  /** Cancelling ends the worker at once and rejects with an AbortError. */
  signal?: AbortSignal;
}

const createMaskWorker = (): MaskWorkerLike => new Worker(new URL('./maskWorker.ts', import.meta.url), { type: 'module' }) as unknown as MaskWorkerLike;

/**
 * Masks R24, R45: runs one heavy job (quantise, group by colour, bake) in a fresh worker so input and drawing stay responsive at S = 2048.
 * The work, the cancel and the failures are those of `startWorkerJob`; where workers do not exist the job runs in the page by `runMaskJob`,
 * which hands the job the caller's own pictures (no job changes them).
 */
export function startMaskJob<K extends MaskJobKind>(kind: K, input: MaskJobs[K]['input'], options: StartMaskJobOptions = {}): Promise<MaskJobs[K]['output']> {
  const { createWorker = typeof Worker === 'undefined' ? undefined : createMaskWorker, signal } = options;
  return startWorkerJob<MaskJobs[K]['output']>({ kind, input }, { createWorker, runInPage: () => runMaskJob(kind, input), signal });
}
