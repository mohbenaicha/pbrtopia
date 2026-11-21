import type { WorkerJobReply } from './startWorkerJob';

/** The pixel buffers inside a result, so a worker hands them over instead of copying them. */
export function collectResultBuffers(result: unknown): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  const visit = (value: unknown, depth: number): void => {
    if (value === null || typeof value !== 'object' || depth > 4) return;
    if (ArrayBuffer.isView(value)) {
      if (value.buffer instanceof ArrayBuffer) buffers.add(value.buffer);
      return;
    }
    for (const entry of Object.values(value)) visit(entry, depth + 1);
  };
  visit(result, 0);
  return [...buffers];
}

/** What a worker file talks to: the global scope of the worker. */
export interface WorkerJobScope {
  onmessage: ((event: { data: { kind: string; input: unknown } }) => void) | null;
  postMessage(reply: WorkerJobReply, transfer?: Transferable[]): void;
}

const isPromise = (value: unknown): value is PromiseLike<unknown> => typeof (value as { then?: unknown } | null)?.then === 'function';

/**
 * Makes this worker answer each message with the result of `run` (or, when `run` gives a promise, what it resolves to), or the failure of the work;
 * pixel buffers in the result are handed over.
 */
export function serveWorkerJobs(scope: WorkerJobScope, run: (kind: string, input: unknown) => unknown): void {
  const answer = (result: unknown): void => scope.postMessage({ type: 'done', result }, collectResultBuffers(result));
  const fail = (error: unknown): void => {
    const failure = error instanceof Error ? error : new Error(String(error));
    scope.postMessage({ type: 'error', message: failure.message, name: failure.name });
  };
  scope.onmessage = ({ data }) => {
    try {
      const result = run(data.kind, data.input);
      if (isPromise(result)) void Promise.resolve(result).then(answer).catch(fail);
      else answer(result);
    } catch (error) {
      fail(error);
    }
  };
}
