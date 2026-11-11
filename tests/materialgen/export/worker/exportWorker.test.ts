import { unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { planExport, readExportBlobs, runExportJob, startExportInWorker, type ExportJob, type ExportOptions, type ExportWorkerLike, type ExportWorkerReply } from '@mat/export';
import { encodePng, type MapRecord, type MapsState, type PixelImage } from '@mat/maps';

const record = (key: string): MapRecord => ({ originalKey: key, workingKey: `w-${key}`, undoKey: null, width: 2, height: 2 });
const state = (): MapsState => ({ size: 2 as unknown as MapsState['size'], maps: { albedo: record('a'), normal: record('n'), rough: record('r'), metal: record('m') } });
const options: ExportOptions = { target: 'blender', packing: 'separate', includeHeight: true, includeAo: true, includeMasks: false, size: 2 };
const plan = () => planExport({ projectName: 'Tile', colorMode: 'albedo', state: state(), hasMasks: false }, options);
const image = (channels: 1 | 3, value: number): PixelImage => ({ width: 2, height: 2, channels, data: new Uint8Array(4 * channels).fill(value) });
const pngBuffer = (channels: 1 | 3, value: number): ArrayBuffer => {
  const bytes = encodePng(image(channels, value));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

function jobFor(files: ExportJob['files']): ExportJob {
  return {
    plan: plan(), options, projectName: 'Tile', colorMode: 'albedo', state: state(), preview: { tilingX: 1, tilingY: 1, heightScale: 0.02, heightLevel: 0.5 },
    masks: null, app: { name: 'material-lab', version: '0.0.0' }, exportedAt: '2026-11-10T12:00:00.000Z', script: null, files,
  };
}

describe('materialgen/export R29 R30 reading the files before the work starts', () => {
  it('R29 reads the working copy of each planned map once, and nothing else', async () => {
    const read = vi.fn(async (key: string) => new Blob([key]));
    const files = await readExportBlobs(plan(), state(), read);
    expect(read.mock.calls.map(([key]) => key).sort()).toEqual(['w-a', 'w-m', 'w-n', 'w-r']);
    expect(Object.keys(files).sort()).toEqual(['albedo', 'metal', 'normal', 'rough']);
  });

  it('R30 a working file that cannot be read fails with a message naming the map', async () => {
    await expect(readExportBlobs(plan(), state(), async (key) => (key === 'w-n' ? null : new Blob([key])))).rejects.toThrow(/normal/i);
  });
});

describe('materialgen/export R32 the job that runs in the worker', () => {
  it('R32 decodes the files, builds the zip and replies with progress and then the bytes', async () => {
    const replies: ExportWorkerReply[] = [];
    await runExportJob(jobFor({ albedo: pngBuffer(3, 90), normal: pngBuffer(3, 128), rough: pngBuffer(1, 60), metal: pngBuffer(1, 5) }), (reply) => replies.push(reply));
    expect(replies[0]).toMatchObject({ type: 'progress', step: { done: 1 } });
    const done = replies.at(-1);
    expect(done).toMatchObject({ type: 'done', fileName: 'Tile.zip' });
    if (done?.type !== 'done') throw new Error('expected done');
    expect(Object.keys(unzipSync(done.bytes))).toEqual(['material.json', 'albedo.png', 'normal.png', 'roughness.png', 'metallic.png']);
  });

  it('R30 R33 a file that will not decode gives a failed reply naming the map', async () => {
    const replies: ExportWorkerReply[] = [];
    await runExportJob(jobFor({ albedo: new ArrayBuffer(3), normal: pngBuffer(3, 1), rough: pngBuffer(1, 1), metal: pngBuffer(1, 1) }), (reply) => replies.push(reply));
    expect(replies.at(-1)).toMatchObject({ type: 'failed' });
    expect((replies.at(-1) as { message: string }).message).toMatch(/albedo/i);
  });
});

class FakeWorker implements ExportWorkerLike {
  onmessage: ((event: { data: ExportWorkerReply }) => void) | null = null;
  onerror: ((event: { message?: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  posted: unknown[] = [];
  terminated = false;
  throwOnPost = false;
  postMessage(message: unknown): void {
    if (this.throwOnPost) throw new Error('DataCloneError');
    this.posted.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(data: ExportWorkerReply): void {
    this.onmessage?.({ data });
  }
}

describe('materialgen/export R32 R33 the main-thread side of the worker', () => {
  it('R32 sends the job, relays progress, resolves with the bytes and ends the worker', async () => {
    const worker = new FakeWorker();
    const steps: string[] = [];
    const pending = startExportInWorker(jobFor({}), { createWorker: () => worker, onProgress: (step) => steps.push(step.text) });
    expect(worker.posted).toHaveLength(1);
    worker.reply({ type: 'progress', step: { text: 'Encoding albedo', done: 1, total: 2 } });
    worker.reply({ type: 'done', bytes: new Uint8Array([1, 2]), fileName: 'Tile.zip' });
    await expect(pending).resolves.toEqual({ bytes: new Uint8Array([1, 2]), fileName: 'Tile.zip' });
    expect(steps).toEqual(['Encoding albedo']);
    expect(worker.terminated).toBe(true);
  });

  it('R33 a failed reply rejects with its message and ends the worker', async () => {
    const worker = new FakeWorker();
    const pending = startExportInWorker(jobFor({}), { createWorker: () => worker });
    worker.reply({ type: 'failed', name: 'ExportReadError', message: 'Normal: the file cannot be read, so nothing was exported.' });
    await expect(pending).rejects.toThrow(/Normal/);
    expect(worker.terminated).toBe(true);
  });

  it('R33 a cancel stops the worker and rejects with an abort', async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const pending = startExportInWorker(jobFor({}), { createWorker: () => worker, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminated).toBe(true);
  });

  it('R33 a cancel that is already pressed never starts a worker', async () => {
    const create = vi.fn(() => new FakeWorker());
    const controller = new AbortController();
    controller.abort();
    await expect(startExportInWorker(jobFor({}), { createWorker: create, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(create).not.toHaveBeenCalled();
  });

  it('R33 a worker that crashes rejects with a message', async () => {
    const worker = new FakeWorker();
    const pending = startExportInWorker(jobFor({}), { createWorker: () => worker });
    worker.onerror?.({ message: 'boom' });
    await expect(pending).rejects.toThrow(/export/i);
    expect(worker.terminated).toBe(true);
  });

  it('R33 a job the worker cannot be handed rejects with a message, ends the worker and leaves no abort listener behind', async () => {
    const worker = new FakeWorker();
    worker.throwOnPost = true;
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    await expect(startExportInWorker(jobFor({}), { createWorker: () => worker, signal: controller.signal })).rejects.toThrow(/export/i);
    expect(worker.terminated).toBe(true);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('R33 a reply that cannot be cloned rejects with a message instead of hanging', async () => {
    const worker = new FakeWorker();
    const pending = startExportInWorker(jobFor({}), { createWorker: () => worker });
    worker.onmessageerror?.();
    await expect(pending).rejects.toThrow(/export/i);
    expect(worker.terminated).toBe(true);
  });
});
