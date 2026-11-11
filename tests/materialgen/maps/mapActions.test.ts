import { describe, expect, it } from 'vitest';
import { planApplyEdits, planChangeSize, planRestoreOriginal, type PlanIo } from '../../../src/materialgen/maps/mapActions';
import { editMaps, placeMap } from '../../../src/materialgen/maps/mapOperations';
import type { MapsState } from '../../../src/materialgen/maps';
import { decodePng, encodePng, type PixelImage } from '../../../src/materialgen/maps/png/pngCodec';

const solid = (width: number, height: number, channels: 1 | 3, value: number): PixelImage => ({ width, height, channels, data: new Uint8Array(width * height * channels).fill(value) });
const png = (image: PixelImage): Blob => new Blob([encodePng(image) as BlobPart], { type: 'image/png' });

function io(files: Record<string, Blob>): PlanIo {
  let counter = 0;
  return { readBlob: async (key) => files[key] ?? null, newKey: () => `n${(counter += 1)}`, label: (kind) => (kind === 'rough' ? 'Roughness' : 'Albedo') };
}
const sizeOf = async (blob: Blob) => {
  const image = decodePng(new Uint8Array(await blob.arrayBuffer())) as PixelImage;
  return [image.width, image.height, image.channels];
};

describe('materialgen/maps R19 planRestoreOriginal', () => {
  it('R19 an original that is already S x S becomes the working map again with no new file', async () => {
    const state = editMaps(placeMap({ size: 256, maps: {} }, 'albedo', { originalKey: 'o', workingKey: 'o', width: 256, height: 256 }), [{ kind: 'albedo', workingKey: 'w' }], 'Filter');
    const outcome = await planRestoreOriginal(state, 'albedo', io({ o: png(solid(256, 256, 3, 5)) }));
    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome.plan.newBlobs.size).toBe(0);
    expect(outcome.plan.next.maps.albedo).toMatchObject({ workingKey: 'o', undoKey: 'w' });
  });

  it('R19 R38 an original of another size is resampled to S x S as a new file', async () => {
    const state = editMaps(placeMap({ size: 256, maps: {} }, 'height', { originalKey: 'o', workingKey: 'w0', width: 300, height: 100 }), [{ kind: 'height', workingKey: 'w' }], 'Filter');
    const outcome = await planRestoreOriginal(state, 'height', io({ o: png(solid(300, 100, 1, 90)) }));
    if (!outcome.ok) throw new Error(outcome.message);
    expect([...outcome.plan.newBlobs.keys()]).toEqual(['n1']);
    expect(await sizeOf(outcome.plan.newBlobs.get('n1')!)).toEqual([256, 256, 1]);
    expect(outcome.plan.next.maps.height?.workingKey).toBe('n1');
  });

  it('R30 an original file that cannot be read stops the restore with a message and changes nothing', async () => {
    const state = editMaps(placeMap({ size: 256, maps: {} }, 'albedo', { originalKey: 'o', workingKey: 'o', width: 256, height: 256 }), [{ kind: 'albedo', workingKey: 'w' }], 'Filter');
    expect(await planRestoreOriginal(state, 'albedo', io({}))).toEqual({ ok: false, message: 'Albedo: the original file cannot be read.' });
  });

  it('R19 nothing happens when the working map already is the original', async () => {
    const state = placeMap({ size: 256, maps: {} }, 'albedo', { originalKey: 'o', workingKey: 'o', width: 256, height: 256 });
    const outcome = await planRestoreOriginal(state, 'albedo', io({}));
    expect(outcome).toMatchObject({ ok: true, plan: { next: state } });
  });
});

describe('materialgen/maps R21 planChangeSize', () => {
  const two = (): MapsState => placeMap(placeMap({ size: 256, maps: {} }, 'albedo', { originalKey: 'a', workingKey: 'a', width: 256, height: 256 }), 'rough', { originalKey: 'r', workingKey: 'r', width: 256, height: 256 });
  const files = (): Record<string, Blob> => ({ a: png(solid(256, 256, 3, 100)), r: png(solid(256, 256, 1, 40)) });

  it('R21 every working map is resampled into a new file at the new S, originals untouched, one group', async () => {
    const outcome = await planChangeSize(two(), 512, io(files()));
    if (!outcome.ok) throw new Error(outcome.message);
    const { next, newBlobs } = outcome.plan;
    expect(next.size).toBe(512);
    expect(newBlobs.size).toBe(2);
    expect(await Promise.all([...newBlobs.values()].map(sizeOf))).toEqual([[512, 512, 3], [512, 512, 1]]);
    expect(next.maps.albedo).toMatchObject({ originalKey: 'a', undoKey: 'a', undo: { label: 'Change size', size: 256 } });
    expect(next.maps.albedo?.undo?.groupId).toBe(next.maps.rough?.undo?.groupId);
  });

  it('R21 the same size changes nothing and writes nothing', async () => {
    const outcome = await planChangeSize(two(), 256, io(files()));
    expect(outcome).toMatchObject({ ok: true, plan: { next: two() } });
    expect(outcome.ok && outcome.plan.newBlobs.size).toBe(0);
  });

  it('R21 setting S with no map writes no file', async () => {
    const outcome = await planChangeSize({ size: null, maps: {} }, 1024, io({}));
    expect(outcome).toMatchObject({ ok: true, plan: { next: { size: 1024, maps: {} } } });
  });

  it('R30 a working file that cannot be read stops the change and writes nothing', async () => {
    const outcome = await planChangeSize(two(), 512, io({ a: png(solid(256, 256, 3, 1)) }));
    expect(outcome).toEqual({ ok: false, message: 'Roughness: the file cannot be read.' });
  });
});

describe('materialgen/maps R16 planApplyEdits', () => {
  const base = (): MapsState => {
    let state = placeMap({ size: 256, maps: {} }, 'albedo', { originalKey: 'oa', workingKey: 'oa', width: 256, height: 256 });
    state = placeMap(state, 'rough', { originalKey: 'or', workingKey: 'or', width: 256, height: 256 });
    return state;
  };

  it('R16 a single-map edit writes one new file and gives the map its own undo entry', async () => {
    const outcome = await planApplyEdits(base(), [{ kind: 'albedo', image: solid(256, 256, 3, 9) }], 'Filter', false, io({}));
    if (!outcome.ok) throw new Error(outcome.message);
    expect([...outcome.plan.newBlobs.keys()]).toEqual(['n1']);
    expect(await sizeOf(outcome.plan.newBlobs.get('n1')!)).toEqual([256, 256, 3]);
    expect(outcome.plan.next.maps.albedo).toMatchObject({ workingKey: 'n1', undoKey: 'oa', undo: { label: 'Filter' } });
    expect(outcome.plan.next.maps.albedo?.undo?.groupId).toBeUndefined();
  });

  it('R70 a grouped edit gives every touched map the same group id', async () => {
    const outcome = await planApplyEdits(base(), [{ kind: 'albedo', image: solid(256, 256, 3, 9) }, { kind: 'rough', image: solid(256, 256, 1, 9) }], 'Mirror', true, io({}));
    if (!outcome.ok) throw new Error(outcome.message);
    const { albedo, rough } = outcome.plan.next.maps;
    expect(albedo?.undo?.groupId).toBeDefined();
    expect(albedo?.undo?.groupId).toBe(rough?.undo?.groupId);
  });

  it('R44 a computed map for an empty slot is placed as a new original with its source recorded', async () => {
    const outcome = await planApplyEdits(base(), [{ kind: 'ao', image: solid(256, 256, 1, 255), derivedFrom: { kind: 'height', key: 'h1' } }], 'Generate AO', false, io({}));
    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome.plan.next.maps.ao).toMatchObject({ originalKey: 'n1', workingKey: 'n1', undoKey: null, derivedFrom: { kind: 'height', key: 'h1' }, source: { kind: 'computed' } });
  });

  it('R44 regenerating over an existing AO map is an edit that keeps the original and records the new source', async () => {
    const state = placeMap(base(), 'ao', { originalKey: 'oo', workingKey: 'oo', width: 256, height: 256 });
    const outcome = await planApplyEdits(state, [{ kind: 'ao', image: solid(256, 256, 1, 200), derivedFrom: { kind: 'height', key: 'h2' } }], 'Generate AO', false, io({}));
    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome.plan.next.maps.ao).toMatchObject({ originalKey: 'oo', workingKey: 'n1', undoKey: 'oo', derivedFrom: { kind: 'height', key: 'h2' } });
  });

  it('R16 nothing to edit changes nothing', async () => {
    const state = base();
    const outcome = await planApplyEdits(state, [], 'Filter', false, io({}));
    expect(outcome).toEqual({ ok: true, plan: { next: state, newBlobs: new Map() } });
  });
});
