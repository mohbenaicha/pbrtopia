import { describe, expect, it } from 'vitest';
import { buildUprightSheet } from '../../../src/generation/normal/buildUprightSheet';
import { handleNormalWork } from '../../../src/generation/normal/handleNormalWork';
import { buildOwnerMap } from '../../../src/generation/normal/height/buildOwnerMap';
import { readSheetHeight } from '../../../src/generation/normal/height/readSheetHeight';
import { smoothHeight } from '../../../src/generation/normal/height/smoothHeight';
import { unpackHeight } from '../../../src/generation/normal/height/unpackHeight';
import { reauthorFromHeight } from '../../../src/generation/normal/reauthor/reauthorFromHeight';
import { createNormalWork, type NormalWorkerLike } from '../../../src/generation/normal/runNormalWork';
import type { PixelPicture } from '../../../src/generation/normal/uprightTypes';
import { DEFAULT_PARAMS } from '../../../src/normalRecipe/reauthorParams';
import { quadMesh, solidPicture } from './meshFixtures';

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

const SIDE = 64;
const MESH = quadMesh({ centre: [0.5, 0.5], half: 0.25, turnDeg: 33 });
const built = buildUprightSheet(solidPicture(SIDE, [200, 100, 50]), MESH);
if (!built.ok) throw new Error('expected a sheet');
const SHEET = built.value;
const rampHeight = (): PixelPicture => {
  const rgba = new Uint8ClampedArray(SIDE * SIDE * 4);
  for (let y = 0; y < SIDE; y += 1) for (let x = 0; x < SIDE; x += 1) rgba.set([x * 4, x * 4, x * 4, 255], (y * SIDE + x) * 4);
  return { side: SIDE, rgba };
};

describe('the finish request of the normal work (normal-height-edit R12)', () => {
  it('normal-height-edit R12 the handler returns the unpacked base height and the normal made from it at DEFAULT_PARAMS, exactly', () => {
    const response = handleNormalWork({ kind: 'finish', height: rampHeight(), sheet: SHEET, mesh: MESH });
    if (response.kind !== 'finish') throw new Error('wrong answer');
    const owner = buildOwnerMap(MESH, SIDE);
    const baseHeight = unpackHeight(readSheetHeight(rampHeight()), SHEET, owner);
    expect(Array.from(response.baseHeight.rgba)).toEqual(Array.from(baseHeight.rgba));
    expect(Array.from(response.normal.rgba)).toEqual(Array.from(reauthorFromHeight(smoothHeight(baseHeight, owner), MESH, DEFAULT_PARAMS).rgba));
    expect(response.baseHeight.side).toBe(SIDE);
    expect(response.normal.side).toBe(SIDE);
  });

  it('normal-height-edit R12 the stored base height is the albedo layout\'s grey picture, and re-making the normal from it gives the stored normal byte for byte', () => {
    const response = handleNormalWork({ kind: 'finish', height: rampHeight(), sheet: SHEET, mesh: MESH });
    if (response.kind !== 'finish') throw new Error('wrong answer');
    const again = reauthorFromHeight(smoothHeight(response.baseHeight, buildOwnerMap(MESH, SIDE)), MESH, DEFAULT_PARAMS);
    expect(Array.from(again.rgba)).toEqual(Array.from(response.normal.rgba)); // Reset to the saved values reproduces the stored picture
    for (let i = 0; i < SIDE * SIDE; i += 1) {
      expect(response.baseHeight.rgba[i * 4]).toBe(response.baseHeight.rgba[i * 4 + 1]);
      expect(response.baseHeight.rgba[i * 4 + 3]).toBe(255);
    }
  });

  it('normal-height-edit R12 work.finish goes through a fresh worker that is ended after the answer, and an aborted one rejects and ends it', async () => {
    const workers: FakeWorker[] = [];
    const work = createNormalWork(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    });
    const made = await work.finish(rampHeight(), SHEET, MESH, new AbortController().signal);
    expect(made.baseHeight.side).toBe(SIDE);
    expect(workers).toHaveLength(1);
    expect(workers[0]!.terminated).toBe(true);
    const controller = new AbortController();
    const pending = work.finish(rampHeight(), SHEET, MESH, controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeDefined();
    expect(workers[1]!.terminated).toBe(true);
  });
});
