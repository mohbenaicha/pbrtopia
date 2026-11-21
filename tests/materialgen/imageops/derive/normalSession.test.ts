import { describe, expect, it } from 'vitest';
import { computeNormalFromHeight, createNormalSession, startNormalJob, type NormalJobInput, type PixelImage, type StartNormalJobOptions } from '@mat/imageops';

const grey = (side: number, at: (x: number, y: number) => number): PixelImage => {
  const data = new Uint8Array(side * side);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) data[y * side + x] = at(x, y);
  return { width: side, height: side, channels: 1, data };
};
const result = (side: number): PixelImage => ({ width: side, height: side, channels: 3, data: new Uint8Array(side * side * 3).fill(7) });

interface RecordedJob { input: NormalJobInput; signal: AbortSignal | undefined; settle(outcome: PixelImage | Error): void }
function createFakeJobs(): { start: (input: NormalJobInput, options: StartNormalJobOptions) => Promise<PixelImage>; jobs: RecordedJob[] } {
  const jobs: RecordedJob[] = [];
  const start = (input: NormalJobInput, options: StartNormalJobOptions): Promise<PixelImage> =>
    new Promise((resolve, reject) => {
      jobs.push({ input, signal: options.signal, settle: (outcome) => (outcome instanceof Error ? reject(outcome) : resolve(outcome)) });
      options.signal?.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true });
    });
  return { start, jobs };
}

describe('imageops normalSession', () => {
  it('normal-from-height R11 the session knows S and the preview size P (S up to 1024, else 1024 or the size given)', () => {
    expect(createNormalSession({ image: grey(8, () => 0) }).previewSize).toBe(8);
    expect(createNormalSession({ image: grey(8, () => 0), previewSize: 4 }).previewSize).toBe(4);
    expect(createNormalSession({ image: grey(8, () => 0), previewSize: 4 }).size).toBe(8);
  });

  it('normal-from-height R7 the final is computed from the full S x S height with the values given', async () => {
    const { start, jobs } = createFakeJobs();
    const image = grey(8, (x) => x * 30);
    const session = createNormalSession({ image, previewSize: 4, startJob: start });
    const pending = session.renderFinal({ blur: 2, strength: 60 });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.input.image).toBe(image);
    expect(jobs[0]!.input.values).toEqual({ blur: 2, strength: 60 });
    jobs[0]!.settle(result(8));
    expect((await pending).width).toBe(8);
  });

  it('normal-from-height R11 the preview is computed on the height reduced to P by a box average, never on the final', async () => {
    const { start, jobs } = createFakeJobs();
    const session = createNormalSession({ image: grey(8, (x, y) => (x + y) * 10), previewSize: 4, startJob: start });
    const pending = session.renderPreview({ blur: 1, strength: 45 });
    const sent = jobs[0]!.input.image;
    expect([sent.width, sent.height, sent.channels]).toEqual([4, 4, 1]);
    expect(sent.data[0]).toBe(10); // (0 + 10 + 10 + 20) / 4
    jobs[0]!.settle(result(4));
    expect((await pending).width).toBe(4);
  });

  it('normal-from-height R10 closing the session ends the work in flight, and a render after close fails without starting work', async () => {
    const { start, jobs } = createFakeJobs();
    const session = createNormalSession({ image: grey(8, () => 0), startJob: start });
    const pending = session.renderFinal({ blur: 1, strength: 45 });
    session.close();
    expect(jobs[0]!.signal?.aborted).toBe(true);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await expect(session.renderPreview({ blur: 1, strength: 45 })).rejects.toThrow(/closed/);
    expect(jobs).toHaveLength(1);
    expect(() => session.close()).not.toThrow();
  });

  it('normal-from-height R10 a failing worker rejects the render and the session still works for the next one', async () => {
    const { start, jobs } = createFakeJobs();
    const session = createNormalSession({ image: grey(8, () => 0), startJob: start });
    const first = session.renderFinal({ blur: 1, strength: 45 });
    jobs[0]!.settle(new Error('The background work stopped unexpectedly. Try again.'));
    await expect(first).rejects.toThrow(/stopped unexpectedly/);
    const second = session.renderFinal({ blur: 1, strength: 45 });
    jobs[1]!.settle(result(8));
    expect((await second).width).toBe(8);
  });

  it('normal-from-height R10 without workers the job runs in the page and gives what computeNormalFromHeight gives', async () => {
    const image = grey(16, (x, y) => (x * 11 + y * 3) % 256);
    const viaJob = await startNormalJob({ image, values: { blur: 1, strength: 45 } }, { createWorker: undefined });
    expect([...viaJob.data]).toEqual([...computeNormalFromHeight(image, { blur: 1, strength: 45 }).data]);
  });

  it('normal-from-height R10 a session on the real job returns the normal map at S and at P', async () => {
    const session = createNormalSession({ image: grey(16, (_x, y) => 255 - y * 8), previewSize: 8, startJob: (input, options) => startNormalJob(input, { ...options, createWorker: undefined }) });
    expect((await session.renderFinal({ blur: 0, strength: 45 })).width).toBe(16);
    const preview = await session.renderPreview({ blur: 0, strength: 45 });
    expect([preview.width, preview.channels]).toEqual([8, 3]);
  });
});
