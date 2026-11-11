import { describe, expect, it } from 'vitest';
import { checkMapsInvariants, isStale, type MapsState } from '@mat/maps';
import { planCommitMasks } from '@mat/maps/planCommitMasks';
import type { PixelImage } from '@mat/imageops';

const grey = (size: number, value: number): PixelImage => ({ width: size, height: size, channels: 1, data: new Uint8Array(size * size).fill(value) });
const keys = (() => {
  let next = 0;
  return () => `k${(next += 1)}`;
})();
const io = { newKey: () => keys() };
const albedoState = (): MapsState => ({ size: 1024, maps: { albedo: { originalKey: 'a-orig', workingKey: 'a-work', undoKey: null, width: 1024, height: 1024 } } });
const bake = () => ({ rough: grey(4, 50), metal: grey(4, 0) });

describe('materialgen/maps planCommitMasks', () => {
  it('R47 the first bake places rough and metal as computed originals made from the labels, with no undo entry', async () => {
    const plan = await planCommitMasks(albedoState(), { labels: { working: grey(4, 1), derivedFrom: { kind: 'albedo', key: 'a-work' } }, bake: bake(), label: 'Material masks' }, io);
    const { rough, metal, labels } = plan.next.maps;
    for (const map of [rough!, metal!]) {
      expect(map.undoKey).toBeNull();
      expect(map.originalKey).toBe(map.workingKey);
      expect(map.source).toEqual({ kind: 'computed' });
      expect(map.derivedFrom).toEqual({ kind: 'labels', key: labels!.workingKey });
    }
    expect(plan.newBlobs.size).toBe(3);
    expect(checkMapsInvariants(plan.next)).toEqual([]);
  });

  it('R31 R66 re-quantised labels replace the working file and keep the decomposition picture as their original', async () => {
    const decomposition = grey(8, 7);
    const first = await planCommitMasks(albedoState(), { labels: { original: decomposition, working: grey(4, 1), derivedFrom: { kind: 'albedo', key: 'a-work' } }, bake: bake(), label: 'Material masks' }, io);
    const before = first.next.maps.labels!;
    expect(before.originalKey).not.toBe(before.workingKey);
    const again = await planCommitMasks(first.next, { labels: { keepOriginal: true, working: grey(4, 2), derivedFrom: { kind: 'albedo', key: 'a-work' } }, label: 'Material masks' }, io);
    const after = again.next.maps.labels!;
    expect(after.originalKey).toBe(before.originalKey);
    expect(after.workingKey).not.toBe(before.workingKey);
    expect([after.width, after.height]).toEqual([before.width, before.height]);
    expect(again.newBlobs.size).toBe(1); // only the new working file is written
    expect(checkMapsInvariants(again.next)).toEqual([]);
  });

  it('R31 keeping the original of labels that do not exist yet is an error', async () => {
    await expect(planCommitMasks(albedoState(), { labels: { keepOriginal: true, working: grey(4, 1), derivedFrom: { kind: 'albedo', key: 'a-work' } }, label: 'x' }, io)).rejects.toThrow();
  });

  it('R47 a later bake is one grouped edit labelled Material masks that gives both maps an undo entry', async () => {
    const first = await planCommitMasks(albedoState(), { labels: { working: grey(4, 1), derivedFrom: { kind: 'albedo', key: 'a-work' } }, bake: bake(), label: 'Material masks' }, io);
    const second = await planCommitMasks(first.next, { bake: { rough: grey(4, 200), metal: grey(4, 255) }, label: 'Material masks' }, io);
    const { rough, metal } = second.next.maps;
    expect(rough!.undo!.label).toBe('Material masks');
    expect(rough!.undoKey).toBe(first.next.maps.rough!.workingKey);
    expect(metal!.undoKey).toBe(first.next.maps.metal!.workingKey);
    expect(rough!.undo!.groupId).toBeUndefined(); // maps R8: only a geometry op sets a group; the Metal-Roughness card undoes both maps itself
    expect(metal!.undo!.groupId).toBeUndefined();
    expect(rough!.originalKey).toBe(first.next.maps.rough!.originalKey); // Restore original returns to the first bake
    expect(second.newBlobs.size).toBe(2);
  });

  it('R32 the baked maps follow the labels they were made from, so they are not stale, and they go stale if the labels change', async () => {
    const first = await planCommitMasks(albedoState(), { labels: { working: grey(4, 1), derivedFrom: { kind: 'albedo', key: 'a-work' } }, bake: bake(), label: 'Material masks' }, io);
    expect(isStale(first.next, 'rough')).toBe(false);
    expect(isStale(first.next, 'labels')).toBe(false);
    const labelsOnly = await planCommitMasks(first.next, { labels: { working: grey(4, 2), derivedFrom: { kind: 'albedo', key: 'a-work' } }, label: 'Material masks' }, io);
    expect(isStale(labelsOnly.next, 'rough')).toBe(true);
  });

  it('R31 labels from a decomposition picture keep that picture as the original and the quantised labels as the working copy', async () => {
    const picture = grey(8, 90);
    const plan = await planCommitMasks(albedoState(), { labels: { original: picture, working: grey(4, 1), derivedFrom: { kind: 'albedo', key: 'a-work' } }, label: 'Material masks' }, io);
    const labels = plan.next.maps.labels!;
    expect(labels.originalKey).not.toBe(labels.workingKey);
    expect([labels.width, labels.height]).toEqual([8, 8]);
    expect(labels.undoKey).toBeNull();
    expect(labels.derivedFrom).toEqual({ kind: 'albedo', key: 'a-work' });
    expect(plan.newBlobs.size).toBe(2);
  });

  it('R31 labels committed without keepOriginal have one file as original and working, and never an undo entry, even when replaced', async () => {
    const first = await planCommitMasks(albedoState(), { labels: { working: grey(4, 1), derivedFrom: { kind: 'albedo', key: 'a-work' } }, label: 'Material masks' }, io);
    expect(first.next.maps.labels!.originalKey).toBe(first.next.maps.labels!.workingKey);
    const again = await planCommitMasks(first.next, { labels: { working: grey(4, 2), derivedFrom: { kind: 'albedo', key: 'a-work' } }, label: 'Material masks' }, io);
    expect(again.next.maps.labels!.undoKey).toBeNull();
    expect(again.next.maps.labels!.workingKey).not.toBe(first.next.maps.labels!.workingKey);
    expect(checkMapsInvariants(again.next)).toEqual([]);
  });

  it('R47 when only one of rough and metal exists, it is edited, the other is placed, and the edit keeps its own undo', async () => {
    const state: MapsState = { size: 1024, maps: { ...albedoState().maps, rough: { originalKey: 'r-orig', workingKey: 'r-orig', undoKey: null, width: 1024, height: 1024, source: { kind: 'dropped', name: 'r.png' } } } };
    const plan = await planCommitMasks(state, { labels: { working: grey(4, 1), derivedFrom: { kind: 'albedo', key: 'a-work' } }, bake: bake(), label: 'Material masks' }, io);
    expect(plan.next.maps.rough!.undoKey).toBe('r-orig');
    expect(plan.next.maps.metal!.undoKey).toBeNull();
    expect(checkMapsInvariants(plan.next)).toEqual([]);
  });

  it('R42 a bake needs labels, in the change or already stored', async () => {
    await expect(planCommitMasks(albedoState(), { bake: bake(), label: 'Material masks' }, io)).rejects.toThrow();
  });
});

describe('materialgen/maps planCommitMasks height offsets (masks R83-R85)', () => {
  const withHeight = (): MapsState => ({ size: 1024, maps: { ...albedoState().maps, height: { originalKey: 'h-orig', workingKey: 'h-orig', undoKey: null, width: 1024, height: 1024, source: { kind: 'dropped', name: 'h.png' } } } });

  it('R85 a height bake is an edit labelled Material masks of Height alone, tagged with its base, and leaves rough and metal untouched', async () => {
    const first = await planCommitMasks(withHeight(), { labels: { working: grey(4, 1), derivedFrom: { kind: 'albedo', key: 'a-work' } }, bake: bake(), label: 'Material masks' }, io);
    const plan = await planCommitMasks(first.next, { height: { image: grey(4, 200), offsetBase: 'h-orig' }, label: 'Material masks' }, io);
    const height = plan.next.maps.height!;
    expect(height).toMatchObject({ undoKey: 'h-orig', offsetBase: 'h-orig', originalKey: 'h-orig' });
    expect(height.undo).toMatchObject({ label: 'Material masks' });
    expect(height.undo!.groupId).toBeUndefined();
    expect(plan.next.maps.rough).toEqual(first.next.maps.rough);
    expect(plan.next.maps.metal).toEqual(first.next.maps.metal);
    expect(plan.newBlobs.size).toBe(1);
    expect(checkMapsInvariants(plan.next)).toEqual([]);
  });

  it('R85 a feather change writes rough, metal and Height as separate edits: no shared group', async () => {
    const first = await planCommitMasks(withHeight(), { labels: { working: grey(4, 1), derivedFrom: { kind: 'albedo', key: 'a-work' } }, bake: bake(), label: 'Material masks' }, io);
    const plan = await planCommitMasks(first.next, { bake: { rough: grey(4, 90), metal: grey(4, 1) }, height: { image: grey(4, 150), offsetBase: 'h-orig' }, label: 'Material masks' }, io);
    const groups = ['rough', 'metal', 'height'].map((kind) => plan.next.maps[kind as 'rough']!.undo?.groupId);
    expect(groups).toEqual([undefined, undefined, undefined]);
    expect(plan.newBlobs.size).toBe(3);
  });

  it('R84 going back to the base sets the working map to the base key itself, with no new file and no tag, as an edit', async () => {
    const baked = await planCommitMasks(withHeight(), { height: { image: grey(4, 200), offsetBase: 'h-orig' }, label: 'Material masks' }, io);
    const plan = await planCommitMasks(baked.next, { height: { backTo: 'h-orig' }, label: 'Material masks' }, io);
    const height = plan.next.maps.height!;
    expect(height.workingKey).toBe('h-orig');
    expect(height.offsetBase).toBeUndefined();
    expect(height.undo).toMatchObject({ label: 'Material masks', offsetBase: 'h-orig' });
    expect(plan.newBlobs.size).toBe(0);
  });

  it('R81 a height commit with no Height map is an error', async () => {
    await expect(planCommitMasks(albedoState(), { height: { image: grey(4, 1), offsetBase: 'x' }, label: 'Material masks' }, io)).rejects.toThrow();
  });
});
