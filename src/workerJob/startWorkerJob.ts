/** What a worker answers with: the result of the work, or its failure. */
export type WorkerJobReply = { type: 'done'; result: unknown } | { type: 'error'; message: string; name: string };

/** The part of a Worker a job uses; tests give a fake. */
export interface WorkerJobHandle {
  onmessage: ((event: { data: WorkerJobReply }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
  onmessageerror: (() => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

export interface WorkerJobOptions<Output> {
  /** Makes the worker; undefined where workers do not exist. */
  createWorker: (() => WorkerJobHandle) | undefined;
  /** The same work, run in the page: used where no worker can be made. */
  runInPage(): Output | Promise<Output>;
  /** Cancelling ends the worker at once and rejects with an AbortError. */
  signal?: AbortSignal | undefined;
}

const STOPPED = 'The background work stopped unexpectedly. Try again.';
const abortError = (): Error => Object.assign(new Error('The work was cancelled.'), { name: 'AbortError' });

/**
 * Runs one job in a fresh worker. The message is copied to the worker, not handed over, so the caller keeps its pictures. A failure in the work or in the
 * worker rejects with a message, and the worker is always ended, also on cancel. Where workers do not exist, or cannot be created (a policy that forbids
 * them), the job runs in the page by `runInPage`.
 */
export function startWorkerJob<Output>(message: { kind: string; input: unknown }, { createWorker, runInPage, signal }: WorkerJobOptions<Output>): Promise<Output> {
  if (signal?.aborted) return Promise.reject(abortError());
  const inPage = (): Promise<Output> => new Promise((resolve) => resolve(runInPage()));
  if (createWorker === undefined) return inPage();
  let worker: WorkerJobHandle;
  try {
    worker = createWorker();
  } catch {
    return inPage();
  }
  return new Promise((resolve, reject) => {
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
      if (data.type === 'done') finish(() => resolve(data.result as Output));
      else finish(() => reject(Object.assign(new Error(data.message), { name: data.name })));
    };
    const stopped = (): void => finish(() => reject(new Error(STOPPED)));
    worker.onerror = stopped;
    worker.onmessageerror = stopped;
    try {
      worker.postMessage(message);
    } catch {
      stopped();
    }
  });
}
