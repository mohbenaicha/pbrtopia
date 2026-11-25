import { describe, expect, it, vi } from 'vitest';
import { handleNormalWork } from '../../../src/generation/normal/handleNormalWork';
import { createNormalWork, type NormalWorkerLike } from '../../../src/generation/normal/runNormalWork';
import { buildUprightSheet } from '../../../src/generation/normal/buildUprightSheet';
import type { PixelPicture } from '../../../src/generation/normal/uprightTypes';
import { quadMesh, solidPicture } from './meshFixtures';

// A worker that answers with the handler on the next tick, the way the real one answers from its own thread.
class FakeWorker implements NormalWorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  terminated = false;
  static all: FakeWorker[] = [];
  constructor() {
    FakeWorker.all.push(this);
  }
  postMessage(message: Parameters<typeof handleNormalWork>[0]): void {
    queueMicrotask(() => {
      if (!this.terminated) this.onmessage?.({ data: handleNormalWork(message) });
    });
  }
  terminate(): void {
    this.terminated = true;
  }
}

const SOURCE = solidPicture(64, [200, 100, 50]);
const MESH = quadMesh({ centre: [0.5, 0.5], half: 0.25, turnDeg: 33 });
const flatHeight = (): PixelPicture => ({ side: 64, rgba: new Uint8ClampedArray(64 * 64 * 4).fill(128) });

describe('runNormalWork', () => {
  it('normal-map R20 the worker answers the same as calling the pure functions directly', async () => {
    const work = createNormalWork(() => new FakeWorker());
    const direct = buildUprightSheet(SOURCE, MESH);
    const prepared = await work.prepare(SOURCE, MESH, new AbortController().signal);
    if (!direct.ok || !prepared.ok) throw new Error('expected sheets');
    expect(Array.from(prepared.value.picture.rgba)).toEqual(Array.from(direct.value.picture.rgba));
    const made = await work.finish(flatHeight(), prepared.value, MESH, new AbortController().signal);
    const response = handleNormalWork({ kind: 'finish', height: flatHeight(), sheet: direct.value, mesh: MESH });
    if (response.kind !== 'finish') throw new Error('wrong answer');
    expect(Array.from(made.normal.rgba)).toEqual(Array.from(response.normal.rgba));
    expect(Array.from(made.baseHeight.rgba)).toEqual(Array.from(response.baseHeight.rgba));
  });

  it('normal-map R15 a refusal of the sheet comes back as the result, not as a throw', async () => {
    const work = createNormalWork(() => new FakeWorker());
    const result = await work.prepare(solidPicture(64, [0, 0, 0]), MESH, new AbortController().signal);
    expect(result).toMatchObject({ ok: false, error: { message: 'The albedo has no baked area to read relief from.' } });
  });

  it('normal-map R20 each call uses a fresh worker that is ended when the call is over', async () => {
    FakeWorker.all = [];
    const work = createNormalWork(() => new FakeWorker());
    await work.prepare(SOURCE, MESH, new AbortController().signal);
    await work.prepare(SOURCE, MESH, new AbortController().signal);
    expect(FakeWorker.all).toHaveLength(2);
    expect(FakeWorker.all.every((worker) => worker.terminated)).toBe(true);
  });

  it('normal-map R11 aborting ends the worker and drops the result', async () => {
    const worker = new FakeWorker();
    worker.postMessage = vi.fn(); // never answers
    const work = createNormalWork(() => worker);
    const controller = new AbortController();
    const pending = work.prepare(SOURCE, MESH, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminated).toBe(true);
  });

  it('normal-map R11 a request that cannot be posted rejects, ends the worker and leaves no abort listener behind', async () => {
    const worker = new FakeWorker();
    worker.postMessage = () => {
      throw new Error('could not be cloned');
    };
    const work = createNormalWork(() => worker);
    const controller = new AbortController();
    const removed = vi.spyOn(controller.signal, 'removeEventListener');
    await expect(work.prepare(SOURCE, MESH, controller.signal)).rejects.toThrow('could not be cloned');
    expect(worker.terminated).toBe(true);
    expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('normal-map R11 an answer that cannot be read rejects instead of leaving the run waiting, and ends the worker', async () => {
    const worker = new FakeWorker();
    worker.postMessage = () => queueMicrotask(() => worker.onmessageerror?.({}));
    const work = createNormalWork(() => worker);
    await expect(work.prepare(SOURCE, MESH, new AbortController().signal)).rejects.toThrow('The island worker sent an answer that could not be read.');
    expect(worker.terminated).toBe(true);
  });

  it('normal-map R20 the finish request sends the sheet\'s layout and side, not a second copy of its pixels', async () => {
    const worker = new FakeWorker();
    const posted: Parameters<typeof handleNormalWork>[0][] = [];
    const post = worker.postMessage.bind(worker);
    worker.postMessage = (message) => {
      posted.push(message);
      post(message);
    };
    const work = createNormalWork(() => worker);
    const built = buildUprightSheet(SOURCE, MESH);
    if (!built.ok) throw new Error('expected a sheet');
    await work.finish(flatHeight(), built.value, MESH, new AbortController().signal);
    const sent = posted[0]!;
    if (sent.kind !== 'finish') throw new Error('expected a finish request');
    expect(sent.sheet.picture.side).toBe(64);
    expect(sent.sheet.picture.rgba.length).toBe(0);
    expect(sent.mesh).toBe(MESH);
  });

  it('normal-map R11 a worker that crashes rejects with its message and is ended', async () => {
    const worker = new FakeWorker();
    worker.postMessage = () => queueMicrotask(() => worker.onerror?.({ message: 'out of memory' }));
    const work = createNormalWork(() => worker);
    await expect(work.finish(flatHeight(), (buildUprightSheet(SOURCE, MESH) as { ok: true; value: never }).value, MESH, new AbortController().signal)).rejects.toThrow('out of memory');
    expect(worker.terminated).toBe(true);
  });
});
