import { startWorkerJob, type WorkerJobHandle } from '@mat/workerjob';
import type { Embedder } from '../table/matchMaterials';

export interface EmbedJobInput {
  texts: string[];
}

export interface CreateWorkerEmbedderOptions {
  /** Makes the worker; undefined where workers do not exist (then every call fails and the matching uses keywords). */
  createWorker?: (() => WorkerJobHandle) | undefined;
}

const createEmbedWorker = (): WorkerJobHandle => new Worker(new URL('./embedWorker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerJobHandle;

/**
 * Masks R73, R77: the MiniLM embedder as a worker job. The model is loaded and run in a fresh worker (the page never blocks; the browser keeps the
 * model files, so a later call does not read them again from the network), and the vectors come back one per text. The model never runs in the page:
 * where no worker can be made the call rejects, and the matching answers with the keyword match.
 */
export function createWorkerEmbedder({ createWorker = typeof Worker === 'undefined' ? undefined : createEmbedWorker }: CreateWorkerEmbedderOptions = {}): Embedder {
  return {
    embed: (texts) =>
      startWorkerJob<Float32Array[]>(
        { kind: 'embed', input: { texts } satisfies EmbedJobInput },
        { createWorker, runInPage: () => Promise.reject(new Error('Workers are not available, so the embedder cannot run.')) },
      ),
  };
}
