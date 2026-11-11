import { describe, expect, it } from 'vitest';
import { planDrop, type DropRequest } from '../../../../src/materialgen/maps/drop/planDrop';
import { placeMap } from '../../../../src/materialgen/maps/mapOperations';
import type { MapsState } from '../../../../src/materialgen/maps';
import { decodePng, type PixelImage } from '../../../../src/materialgen/maps/png/pngCodec';

const empty: MapsState = { size: null, maps: {} };
const solid = (width: number, height: number, channels: 1 | 3 | 4, value: number): PixelImage => ({ width, height, channels, data: new Uint8Array(width * height * channels).fill(value) });

function request(patch: Partial<DropRequest> & Pick<DropRequest, 'kind' | 'image'>): DropRequest {
  let counter = 0;
  return { state: empty, fileName: 'brick.png', newKey: () => `k${(counter += 1)}`, ...patch };
}
const decoded = async (blob: Blob) => decodePng(new Uint8Array(await blob.arrayBuffer())) as PixelImage;

describe('materialgen/maps R36 R38 R39 R35 planDrop onto an empty slot (a place)', () => {
  it('R36 R15 the first image sets S, is the original and, when it is S x S, its own working map (one blob)', async () => {
    const outcome = await planDrop(request({ kind: 'albedo', image: solid(8, 8, 3, 90) }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { next, newBlobs } = outcome.plan;
    expect(next.size).toBe(256);
    expect(newBlobs.size).toBe(2); // 8 x 8 is not 256: original native plus a resampled working map
    expect(next.maps.albedo).toMatchObject({ originalKey: 'k1', workingKey: 'k2', undoKey: null, width: 8, height: 8, source: { kind: 'dropped', name: 'brick.png' } });
  });

  it('R38 an S x S image becomes original and working under one key', async () => {
    const outcome = await planDrop(request({ state: { size: 256, maps: {} }, kind: 'albedo', image: solid(256, 256, 3, 90) }));
    expect(outcome.ok && outcome.plan.newBlobs.size).toBe(1);
    expect(outcome.ok && outcome.plan.next.maps.albedo?.workingKey).toBe('k1');
  });

  it('R38 R39 a non-square image keeps its native original and gets an S x S working map', async () => {
    const outcome = await planDrop(request({ state: { size: 256, maps: {} }, kind: 'height', image: solid(300, 100, 3, 80) }));
    if (!outcome.ok) throw new Error(outcome.message);
    const { next, newBlobs } = outcome.plan;
    expect(next.maps.height).toMatchObject({ width: 300, height: 100 });
    const original = await decoded(newBlobs.get(next.maps.height!.originalKey)!);
    const working = await decoded(newBlobs.get(next.maps.height!.workingKey)!);
    expect([original.width, original.height, original.channels]).toEqual([300, 100, 1]);
    expect([working.width, working.height, working.channels]).toEqual([256, 256, 1]);
  });

  it('R35 a colour image on a grey slot is stored as luminance and alpha on a colour slot is dropped', async () => {
    const grey = await planDrop(request({ state: { size: 256, maps: {} }, kind: 'rough', image: solid(256, 256, 3, 255) }));
    const colour = await planDrop(request({ state: { size: 256, maps: {} }, kind: 'albedo', image: solid(256, 256, 4, 40) }));
    if (!grey.ok || !colour.ok) throw new Error('refused');
    expect((await decoded([...grey.plan.newBlobs.values()][0]!)).channels).toBe(1);
    expect((await decoded([...colour.plan.newBlobs.values()][0]!)).channels).toBe(3);
  });

  it('R38 an image with a side above 8192 pixels is refused', async () => {
    const outcome = await planDrop(request({ kind: 'albedo', image: { width: 8193, height: 1, channels: 3, data: new Uint8Array(8193 * 3) } }));
    expect(outcome).toEqual({ ok: false, message: 'Image too large' });
  });

  it('R43 the hidden Decomposition slot accepts no drop', async () => {
    expect(await planDrop(request({ kind: 'labels', image: solid(4, 4, 3, 1) }))).toEqual({ ok: false, message: 'The decomposition accepts no dropped image.' });
  });
});

describe('materialgen/maps R37 R17 R33 planDrop onto a filled slot (an edit)', () => {
  const filled = (): MapsState => placeMap({ size: 256, maps: {} }, 'albedo', { originalKey: 'a1', workingKey: 'a1', width: 256, height: 256 });

  it('R37 the dropped image becomes the new working map, the original stays and the previous working map is the undo copy', async () => {
    const outcome = await planDrop(request({ state: filled(), kind: 'albedo', image: solid(256, 256, 3, 10) }));
    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome.plan.next.maps.albedo).toMatchObject({ originalKey: 'a1', workingKey: 'k1', undoKey: 'a1' });
    expect(outcome.plan.newBlobs.size).toBe(1);
  });

  it('R37 a working map equal to its original goes from one blob to two', async () => {
    const outcome = await planDrop(request({ state: filled(), kind: 'albedo', image: solid(256, 256, 3, 10) }));
    const keys = new Set(outcome.ok ? [outcome.plan.next.maps.albedo!.originalKey, outcome.plan.next.maps.albedo!.workingKey] : []);
    expect(keys.size).toBe(2);
  });

  it('R33 a dropped image on a derived map clears its derivedFrom', async () => {
    let state = placeMap(filled(), 'normal', { originalKey: 'n1', workingKey: 'n1', width: 256, height: 256 });
    state = placeMap(state, 'ao', { originalKey: 'o1', workingKey: 'o1', width: 256, height: 256, derivedFrom: { kind: 'normal', key: 'n1' } });
    const outcome = await planDrop(request({ state, kind: 'ao', image: solid(256, 256, 1, 10) }));
    expect(outcome.ok && outcome.plan.next.maps.ao?.derivedFrom).toBeUndefined();
  });

  it('R38 an image of another size is resampled to S for the working map', async () => {
    const outcome = await planDrop(request({ state: filled(), kind: 'albedo', image: solid(64, 64, 3, 10) }));
    if (!outcome.ok) throw new Error(outcome.message);
    const working = await decoded(outcome.plan.newBlobs.get('k1')!);
    expect([working.width, working.height]).toEqual([256, 256]);
  });

  it('R42 a normal map dropped on a colour-less slot keeps its vectors near unit length after resampling', async () => {
    const state = placeMap({ size: 256, maps: {} }, 'normal', { originalKey: 'n1', workingKey: 'n1', width: 256, height: 256 });
    const image: PixelImage = { width: 2, height: 2, channels: 3, data: Uint8Array.from([230, 128, 230, 26, 128, 230, 230, 128, 230, 26, 128, 230]) };
    const outcome = await planDrop(request({ state, kind: 'normal', image }));
    if (!outcome.ok) throw new Error(outcome.message);
    const working = await decoded(outcome.plan.newBlobs.get('k1')!);
    const [r, g, b] = [working.data[0]!, working.data[1]!, working.data[2]!].map((value) => (value / 255) * 2 - 1) as [number, number, number];
    expect(Math.hypot(r, g, b)).toBeGreaterThan(0.98);
    expect(Math.hypot(r, g, b)).toBeLessThan(1.02);
  });
});
