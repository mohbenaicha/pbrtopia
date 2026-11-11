import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PixelImage } from '@mat/imageops';
import { bakeCurrentRows, buildModelMasks, hexToRgb, paletteFor, parseBaseMaterials } from '@mat/masks';
import { startMaskJob, type MaskWorkerLike } from '@mat/masks/worker/startMaskJob';

afterEach(() => vi.unstubAllGlobals());

const table = parseBaseMaterials({ Brick: [0.8, 0, [160, 60, 40]], Steel: [0.3, 1, [200, 200, 205]] });
const palette = paletteFor(2);
const decomposition: PixelImage = (() => {
  const data = new Uint8Array(8 * 8 * 3);
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) data.set(hexToRgb(palette[x < 4 ? 0 : 1]!.hex), (y * 8 + x) * 3);
  return { width: 8, height: 8, channels: 3, data };
})();
const component = (name: string) => ({ name, description: '', location: '' });
const made = buildModelMasks({
  decomposition, components: [component('Wall'), component('Plate')], table, size: 8, feather: 0,
  matches: [{ material: 'Brick', top3: ['Brick'], kind: 'keyword' }, { material: 'Steel', top3: ['Steel'], kind: 'keyword' }],
});
if (!made.ok) throw new Error(made.message);
const built = { labels: made.value.labels, record: made.value.record };
const job = built;
const baked = bakeCurrentRows(built.labels, built.record);

function fakeWorker() {
  const worker = { onmessage: null, onerror: null, onmessageerror: null, postMessage: vi.fn(), terminate: vi.fn() } as unknown as MaskWorkerLike & { postMessage: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> };
  return worker;
}

describe('materialgen/masks R24 R45 startMaskJob', () => {
  it('R45 the job goes to a worker, its answer is the result, and the worker is ended', async () => {
    const worker = fakeWorker();
    const pending = startMaskJob('bake', { labels: built.labels, record: built.record }, { createWorker: () => worker });
    expect(worker.postMessage).toHaveBeenCalledWith({ kind: 'bake', input: { labels: built.labels, record: built.record } });
    worker.onmessage!({ data: { type: 'done', result: bakeCurrentRows(built.labels, built.record) } });
    await expect(pending).resolves.toEqual(bakeCurrentRows(built.labels, built.record));
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('R24 a failure inside the worker rejects with its message and ends the worker', async () => {
    const worker = fakeWorker();
    const pending = startMaskJob('bake', job, { createWorker: () => worker });
    worker.onmessage!({ data: { type: 'error', message: 'out of memory', name: 'RangeError' } });
    await expect(pending).rejects.toMatchObject({ message: 'out of memory', name: 'RangeError' });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('R24 a worker that stops without an answer rejects instead of waiting for ever', async () => {
    const worker = fakeWorker();
    const pending = startMaskJob('bake', job, { createWorker: () => worker });
    worker.onerror!({});
    await expect(pending).rejects.toThrow(/stopped/i);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('R24 a job that cannot be handed over rejects and ends the worker', async () => {
    const worker = fakeWorker();
    worker.postMessage.mockImplementation(() => { throw new Error('DataCloneError'); });
    await expect(startMaskJob('bake', job, { createWorker: () => worker })).rejects.toThrow(/stopped/i);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('R24 cancelling ends the worker at once and rejects with an AbortError', async () => {
    const worker = fakeWorker();
    const controller = new AbortController();
    const pending = startMaskJob('bake', job, { createWorker: () => worker, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('R24 a signal that is already aborted starts no worker', async () => {
    const createWorker = vi.fn(() => fakeWorker());
    const controller = new AbortController();
    controller.abort();
    await expect(startMaskJob('bake', job, { createWorker, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(createWorker).not.toHaveBeenCalled();
  });

  it('R24 a worker that cannot be created (a policy that forbids it) runs the job in the page instead', async () => {
    const createWorker = (): MaskWorkerLike => { throw new Error('blocked'); };
    await expect(startMaskJob('bake', job, { createWorker })).resolves.toEqual(baked);
  });

  it('R24 a reply that cannot be read rejects, and a second reply after it changes nothing', async () => {
    const worker = fakeWorker();
    const pending = startMaskJob('bake', job, { createWorker: () => worker });
    worker.onmessageerror!();
    await expect(pending).rejects.toThrow(/stopped/i);
    expect(worker.onmessage).toBeNull();
  });

  it('R24 where workers do not exist the job runs in the page and gives the same result', async () => {
    vi.stubGlobal('Worker', undefined);
    await expect(startMaskJob('bake', job)).resolves.toEqual(baked);
  });
});
