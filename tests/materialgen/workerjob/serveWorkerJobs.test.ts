import { describe, expect, it, vi } from 'vitest';
import { collectResultBuffers, serveWorkerJobs, type WorkerJobScope } from '@mat/workerjob';

function fakeScope() {
  const scope = { onmessage: null, postMessage: vi.fn() } as unknown as WorkerJobScope & { postMessage: ReturnType<typeof vi.fn> };
  return scope;
}

describe('materialgen/workerjob R24 R60 serveWorkerJobs', () => {
  it('R24 R60 the answer is the result, with the pixel buffers handed over', () => {
    const scope = fakeScope();
    const pixels = new Uint8Array([1, 2, 3]);
    serveWorkerJobs(scope, (kind, input) => ({ kind, input, image: { data: pixels } }));
    scope.onmessage!({ data: { kind: 'bake', input: 7 } });
    expect(scope.postMessage).toHaveBeenCalledWith({ type: 'done', result: { kind: 'bake', input: 7, image: { data: pixels } } }, [pixels.buffer]);
  });

  it('R24 R60 a failure of the work is answered with its message and name, and the worker stays usable', () => {
    const scope = fakeScope();
    let fail = true;
    serveWorkerJobs(scope, () => {
      if (fail) throw new RangeError('too large');
      return 'ok';
    });
    scope.onmessage!({ data: { kind: 'x', input: null } });
    expect(scope.postMessage).toHaveBeenLastCalledWith({ type: 'error', message: 'too large', name: 'RangeError' });
    fail = false;
    scope.onmessage!({ data: { kind: 'x', input: null } });
    expect(scope.postMessage).toHaveBeenLastCalledWith({ type: 'done', result: 'ok' }, []);
  });

  it('R73 work that finishes later (a promise) is answered with what it resolves to, or with its failure', async () => {
    const scope = fakeScope();
    const vectors = new Float32Array([1, 2]);
    serveWorkerJobs(scope, (kind) => (kind === 'bad' ? Promise.reject(new Error('model files missing')) : Promise.resolve([vectors])));
    scope.onmessage!({ data: { kind: 'embed', input: null } });
    await vi.waitFor(() => expect(scope.postMessage).toHaveBeenLastCalledWith({ type: 'done', result: [vectors] }, [vectors.buffer]));
    scope.onmessage!({ data: { kind: 'bad', input: null } });
    await vi.waitFor(() => expect(scope.postMessage).toHaveBeenLastCalledWith({ type: 'error', message: 'model files missing', name: 'Error' }));
  });

  it('R24 R60 a thing thrown that is not an Error is still answered as a failure', () => {
    const scope = fakeScope();
    serveWorkerJobs(scope, () => {
      throw 'plain text';
    });
    scope.onmessage!({ data: { kind: 'x', input: null } });
    expect(scope.postMessage).toHaveBeenCalledWith({ type: 'error', message: 'plain text', name: 'Error' });
  });
});

describe('materialgen/workerjob R60 collectResultBuffers', () => {
  it('R60 finds the buffers of byte and float arrays inside a result, once each', () => {
    const shared = new Uint8Array(4);
    const floats = new Float32Array(2);
    const found = collectResultBuffers({ a: shared, b: { again: shared, floats }, list: [new Uint8Array(1)] });
    expect(found).toContain(shared.buffer);
    expect(found).toContain(floats.buffer);
    expect(found).toHaveLength(3);
  });

  it('R60 gives nothing for a result without arrays, and stops at a depth where a cycle would never end', () => {
    expect(collectResultBuffers({ ok: true, name: 'x' })).toEqual([]);
    const loop: Record<string, unknown> = {};
    loop['self'] = loop;
    expect(collectResultBuffers(loop)).toEqual([]);
  });
});
