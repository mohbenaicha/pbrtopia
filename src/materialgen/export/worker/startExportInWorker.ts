import type { ExportProgress } from '../build/buildExportZip';
import type { ExportJob, ExportWorkerReply } from './exportProtocol';

/** The part of a Worker the export uses; tests give a fake. */
export interface ExportWorkerLike {
  onmessage: ((event: { data: ExportWorkerReply }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
  onmessageerror: (() => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
}

export interface StartExportOptions {
  onProgress?: (step: ExportProgress) => void;
  signal?: AbortSignal;
  createWorker?: () => ExportWorkerLike;
}

const abortError = (): Error => Object.assign(new Error('The export was cancelled.'), { name: 'AbortError' });
const createExportWorker = (): ExportWorkerLike => new Worker(new URL('./exportWorker.ts', import.meta.url), { type: 'module' }) as unknown as ExportWorkerLike;

/**
 * Export R32, R33: runs the job in a fresh worker and resolves with the zip. Cancelling stops the worker at once (nothing is returned); a failure
 * in the work or in the worker rejects with a message. The worker is always ended.
 */
export function startExportInWorker(job: ExportJob, options: StartExportOptions = {}): Promise<{ bytes: Uint8Array; fileName: string }> {
  const { signal, onProgress, createWorker = createExportWorker } = options;
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const worker = createWorker();
    const finish = (settle: () => void): void => {
      signal?.removeEventListener('abort', onAbort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      settle();
    };
    const onAbort = (): void => finish(() => reject(abortError()));
    signal?.addEventListener('abort', onAbort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress?.(data.step);
      else if (data.type === 'done') finish(() => resolve({ bytes: data.bytes, fileName: data.fileName }));
      else finish(() => reject(Object.assign(new Error(data.message), { name: data.name })));
    };
    const stopped = (): void => finish(() => reject(new Error('The export stopped unexpectedly. Try again.')));
    worker.onerror = stopped;
    worker.onmessageerror = stopped; // a reply that cannot be cloned would never arrive
    try {
      worker.postMessage(job, Object.values(job.files));
    } catch {
      stopped(); // a file that cannot be handed over: the worker and the abort listener are released
    }
  });
}
