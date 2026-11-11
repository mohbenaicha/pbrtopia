import { describe, expect, it, vi } from 'vitest';
import { decodePng, encodePng, PngError, PngTooLargeError, type PixelImage } from '../../../../src/materialgen/maps/png/pngCodec';
import { decodePngOffThread, encodePngBlob, encodeResizedPngBlob, OFF_THREAD_PIXELS } from '../../../../src/materialgen/maps/png/pngOffThread';
import { resampleToSquare } from '../../../../src/materialgen/maps/pixels/resampleToSquare';
import { runPngJob, type PngJobKind } from '../../../../src/materialgen/maps/png/worker/pngJobs';
import { startPngJob } from '../../../../src/materialgen/maps/png/worker/startPngJob';
import type { WorkerJobHandle } from '@mat/workerjob';

const picture = (width: number, height: number): PixelImage => {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 1) data[i] = (i * 7) & 255;
  return { width, height, channels: 4, data };
};

/** A flat picture compresses at once, so the tests of the large path stay quick under load. */
const flat = (width: number, height: number): PixelImage => ({ width, height, channels: 4, data: new Uint8Array(width * height * 4).fill(90) });

/** A worker that does the job at once, in the way the real one does, and answers with its reply. */
function workingWorker() {
  const worker = { onmessage: null, onerror: null, onmessageerror: null, terminate: vi.fn(), postMessage: vi.fn() } as unknown as WorkerJobHandle & { postMessage: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> };
  worker.postMessage.mockImplementation((message: { kind: PngJobKind; input: never }) => {
    queueMicrotask(() => worker.onmessage?.({ data: { type: 'done', result: runPngJob(message.kind, message.input) } }));
  });
  return worker;
}

describe('materialgen/maps R60 PNG jobs', () => {
  it('R60 runPngJob encodes to the same bytes as the codec, and decodes them back', () => {
    const image = picture(4, 3);
    const bytes = runPngJob('encode', { image });
    expect(bytes).toEqual(encodePng(image));
    const decoded = runPngJob('decode', { bytes, maxSide: 100 });
    expect(decoded).toEqual({ ok: true, image });
  });

  it('R60 a damaged file and a too-large side come back as data the page can turn into the codec errors', () => {
    expect(runPngJob('decode', { bytes: new Uint8Array([1, 2, 3]), maxSide: 100 })).toMatchObject({ ok: false, reason: 'damaged' });
    const bytes = encodePng(picture(8, 8));
    expect(runPngJob('decode', { bytes, maxSide: 4 })).toMatchObject({ ok: false, reason: 'too-large' });
  });

  it('R60 a job that is not known throws', () => {
    expect(() => runPngJob('nothing' as 'encode', { image: picture(1, 1) })).toThrow(/Unknown PNG job/);
  });

  it('R60 where workers do not exist the job runs in the page and gives the same answer', async () => {
    vi.stubGlobal('Worker', undefined);
    try {
      const image = picture(4, 4);
      await expect(startPngJob('encode', { image })).resolves.toEqual(encodePng(image));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('materialgen/maps R60 encodeResizedPngBlob', () => {
  it('R60 runPngJob resizeEncode gives the bytes of resampleToSquare then the encoder, for a normal map too', () => {
    const image: PixelImage = { width: 6, height: 4, channels: 3, data: Uint8Array.from({ length: 72 }, (_, i) => (i * 11) & 255) };
    for (const normal of [false, true]) {
      const bytes = runPngJob('resizeEncode', { image, side: 8, normal });
      expect(bytes).toEqual(encodePng(resampleToSquare(image, 8, { normal })));
    }
  });

  it('R60 a large result is resampled and encoded in one worker job; the blob holds the same PNG', async () => {
    const worker = workingWorker();
    const image = flat(8, 8);
    const side = 513; // 513 x 513 is over the limit although the source is tiny
    const blob = await encodeResizedPngBlob(image, side, { normal: false }, { createWorker: () => worker });
    expect(worker.postMessage).toHaveBeenCalledOnce();
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(encodePng(resampleToSquare(image, side)));
  });

  it('R60 a large source reduced to a small result is also done in the worker', async () => {
    const worker = workingWorker();
    const image = flat(OFF_THREAD_PIXELS / 256 + 1, 256);
    await encodeResizedPngBlob(image, 64, { normal: false }, { createWorker: () => worker });
    expect(worker.postMessage).toHaveBeenCalledOnce();
  });

  it('R60 when both source and result are small it is done in the page, with no worker made', async () => {
    const createWorker = vi.fn(workingWorker);
    const image = picture(16, 16);
    const blob = await encodeResizedPngBlob(image, 32, { normal: false }, { createWorker });
    expect(createWorker).not.toHaveBeenCalled();
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(encodePng(resampleToSquare(image, 32)));
  });
});

describe('materialgen/maps R60 encodePngBlob and decodePngOffThread', () => {
  it('R60 a large picture is encoded in the worker, and the blob holds the same PNG', async () => {
    const worker = workingWorker();
    const image = flat(OFF_THREAD_PIXELS / 256 + 1, 256); // one pixel row over the limit
    const blob = await encodePngBlob(image, { createWorker: () => worker });
    expect(worker.postMessage).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(blob.type).toBe('image/png');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(encodePng(image));
  });

  it('R60 a small picture is encoded in the page, with no worker made', async () => {
    const createWorker = vi.fn(workingWorker);
    const image = picture(16, 16);
    const blob = await encodePngBlob(image, { createWorker });
    expect(createWorker).not.toHaveBeenCalled();
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(encodePng(image));
  });

  it('R60 a large PNG is decoded in the worker; a small one in the page', async () => {
    const big = encodePng(flat(OFF_THREAD_PIXELS / 256 + 1, 256));
    const bigWorker = workingWorker();
    const decoded = await decodePngOffThread(big, undefined, { createWorker: () => bigWorker });
    expect(bigWorker.postMessage).toHaveBeenCalledOnce();
    expect(decoded).toEqual(decodePng(big));

    const createWorker = vi.fn(workingWorker);
    await decodePngOffThread(encodePng(picture(8, 8)), undefined, { createWorker });
    expect(createWorker).not.toHaveBeenCalled();
  });

  it('R60 a too-large side from the worker is a PngTooLargeError, a damaged file a PngError, as from the page', async () => {
    const big = encodePng(flat(OFF_THREAD_PIXELS / 256 + 1, 256));
    await expect(decodePngOffThread(big, 100, { createWorker: workingWorker })).rejects.toBeInstanceOf(PngTooLargeError);
    const damaged = big.slice(0, 40); // the header is there, the data is not
    await expect(decodePngOffThread(damaged, undefined, { createWorker: workingWorker })).rejects.toBeInstanceOf(PngError);
    await expect(decodePngOffThread(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(PngError); // not a PNG at all: the page says so
  });
});
