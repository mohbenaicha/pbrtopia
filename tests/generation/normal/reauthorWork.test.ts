import { describe, expect, it } from 'vitest';
import { handleNormalWork } from '../../../src/generation/normal/handleNormalWork';
import { reauthorNormal } from '../../../src/generation/normal/reauthor/reauthorNormal';
import { createNormalWork, type NormalWorkerLike } from '../../../src/generation/normal/runNormalWork';
import { DEFAULT_PARAMS } from '../../../src/normalRecipe/reauthorParams';
import { twoWallsWithSeam, solidPicture, encodeNormal } from './reauthor/reauthorFixtures';

class FakeWorker implements NormalWorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  terminated = false;
  postMessage(message: Parameters<typeof handleNormalWork>[0]): void {
    queueMicrotask(() => {
      if (!this.terminated) this.onmessage?.({ data: handleNormalWork(message) });
    });
  }
  terminate(): void {
    this.terminated = true;
  }
}

const BASE = solidPicture(128, encodeNormal(0.5, 0, 0.866));
const MESH = twoWallsWithSeam();

describe('the re-authoring request of the normal work (normal-reauthor R17)', () => {
  it('normal-reauthor R17 the handler answers a reauthor request with exactly what reauthorNormal returns', () => {
    const response = handleNormalWork({ kind: 'reauthor', base: BASE, mesh: MESH, params: DEFAULT_PARAMS });
    if (response.kind !== 'reauthor') throw new Error('wrong answer');
    expect(Array.from(response.pixels.rgba)).toEqual(Array.from(reauthorNormal(BASE, MESH, DEFAULT_PARAMS).rgba));
  });

  it('normal-reauthor R4 the handler clamps the params it is given, as every other entry point does', () => {
    const response = handleNormalWork({ kind: 'reauthor', base: BASE, mesh: MESH, params: { slopeDeg: 900, seamRadius: -4, seamFlatten: 100 } });
    if (response.kind !== 'reauthor') throw new Error('wrong answer');
    expect(Array.from(response.pixels.rgba)).toEqual(Array.from(reauthorNormal(BASE, MESH, { slopeDeg: 80, seamRadius: 0, seamFlatten: 100 }).rgba));
  });

  it('normal-reauthor R17 work.reauthor goes through a fresh worker that is ended after the answer, and returns the same pixels', async () => {
    const workers: FakeWorker[] = [];
    const work = createNormalWork(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    });
    const pixels = await work.reauthor(BASE, MESH, DEFAULT_PARAMS, new AbortController().signal);
    expect(Array.from(pixels.rgba)).toEqual(Array.from(reauthorNormal(BASE, MESH, DEFAULT_PARAMS).rgba));
    expect(workers).toHaveLength(1);
    expect(workers[0]!.terminated).toBe(true);
  });

  it('normal-reauthor R17 an aborted work.reauthor rejects and ends the worker', async () => {
    const controller = new AbortController();
    const workers: FakeWorker[] = [];
    const work = createNormalWork(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    });
    const pending = work.reauthor(BASE, MESH, DEFAULT_PARAMS, controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeDefined();
    expect(workers[0]!.terminated).toBe(true);
  });
});
