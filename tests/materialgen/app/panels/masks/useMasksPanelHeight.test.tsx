// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PixelImage } from '@mat/imageops';
import type { MapsState, MasksCommit } from '@mat/maps';
import { encodePng } from '@mat/maps/png/pngCodec';
import { parseBaseMaterials, parseMasksRecord, type MasksRecord } from '@shared/materialMasks';
import { useMasksPanel, type MasksPanelPorts } from '../../../../../src/materialgen/app/panels/masks/useMasksPanel';

// Masks R81-R88 in the panel hook: the height offsets go to Height alone, from the base the working Height carries a tag for.
const table = parseBaseMaterials({ Brick: [0.8, 0, [160, 60, 40]], Steel: [0.3, 1, [200, 200, 205]] });
const png = (image: PixelImage): Blob => new Blob([encodePng(image) as BlobPart], { type: 'image/png' });
const grey = (side: number, value: number): PixelImage => ({ width: side, height: side, channels: 1, data: new Uint8Array(side * side).fill(value) });
const twoColours = (side = 8): PixelImage => {
  const data = new Uint8Array(side * side * 3);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) data.set(x < side / 2 ? [160, 60, 40] : [200, 200, 205], (y * side + x) * 3);
  return { width: side, height: side, channels: 3, data };
};
const halves = (side = 8): PixelImage => {
  const data = new Uint8Array(side * side);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) data[y * side + x] = x < side / 2 ? 0 : 1;
  return { width: side, height: side, channels: 1, data };
};

const TINY = 8 as unknown as MapsState['size']; // the test pictures are 8 x 8
/** Albedo, labels and a Height map; `tagged` makes the working Height a bake of base `hb`. */
const state = (tagged: boolean): MapsState => ({
  size: TINY,
  maps: {
    albedo: { originalKey: 'a', workingKey: 'a', undoKey: null, width: 8, height: 8 },
    labels: { originalKey: 'l', workingKey: 'l', undoKey: null, width: 8, height: 8, derivedFrom: { kind: 'albedo', key: 'a' } },
    height: tagged
      ? { originalKey: 'h0', workingKey: 'h1', undoKey: 'h0', undo: { label: 'Material masks' }, width: 8, height: 8, offsetBase: 'hb' }
      : { originalKey: 'h0', workingKey: 'h0', undoKey: null, width: 8, height: 8 },
  },
});
const record = (heights: [number, number] = [0, 0], feather = 0): MasksRecord => ({
  source: 'model',
  palette: [{ label: 0, hex: '#FF0000', name: 'red' }, { label: 1, hex: '#00FF00', name: 'green' }],
  feather,
  rows: [
    { label: 0, name: 'Wall', description: '', location: '', defaultMaterial: 'Brick', top3: ['Brick'], matchKind: 'colour', material: 'Brick', rough: 0.8, metal: 0, height: heights[0] },
    { label: 1, name: 'Plate', description: '', location: '', defaultMaterial: 'Steel', top3: ['Steel'], matchKind: 'colour', material: 'Steel', rough: 0.3, metal: 1, height: heights[1] },
  ],
});

function setup(maps: MapsState, masks: MasksRecord, missing: string[] = []) {
  const blobs = new Map<string, Blob>([['a', png(twoColours())], ['l', png(halves())], ['h0', png(grey(8, 100))], ['hb', png(grey(8, 100))], ['h1', png(grey(8, 164))]]);
  for (const key of missing) blobs.delete(key);
  const commits: Array<{ commit: MasksCommit; record: Record<string, unknown> }> = [];
  const commitMasks = vi.fn(async (commit: MasksCommit, saved: Record<string, unknown>) => (commits.push({ commit, record: saved }), true));
  const ports: MasksPanelPorts = {
    state: maps, masksRecord: masks as unknown as Record<string, unknown>, canWrite: true,
    controller: { commitMasks, refuse: vi.fn() }, readBlob: async (key) => blobs.get(key) ?? null, loadTable: async () => table,
    model: { disabledReason: 'off', running: false, error: null, canRetry: false, modelNames: '', onCreate: vi.fn(), onRerun: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn() },
  };
  const view = renderHook(() => useMasksPanel(ports));
  return { view, commits };
}
const ready = (view: ReturnType<typeof setup>['view']) => waitFor(() => expect(view.result.current.table).not.toBeNull());

describe('materialgen/app useMasksPanel height offsets (masks R81-R88)', () => {
  it('R81 the panel says whether the Height slot has a working map', async () => {
    const { view } = setup(state(false), record());
    expect(view.result.current.hasHeightMap).toBe(true);
    const bare = setup({ size: TINY, maps: { albedo: state(false).maps.albedo!, labels: state(false).maps.labels! } }, record());
    expect(bare.view.result.current.hasHeightMap).toBe(false);
  });

  it('R82 R85 a released Height value writes Height alone: base plus the offset, tagged with its base, and no rough or metal bake', async () => {
    const { view, commits } = setup(state(false), record());
    await ready(view);
    await act(async () => { view.result.current.onRowHeight(1, 1); });
    await waitFor(() => expect(commits).toHaveLength(1));
    const { commit, record: saved } = commits[0]!;
    expect(commit.bake).toBeUndefined();
    expect(commit.labels).toBeUndefined();
    expect(commit.height).toMatchObject({ offsetBase: 'h0' }); // an untagged working Height is its own base (R83)
    const image = (commit.height as { image: PixelImage }).image;
    expect(image.data[7]).toBe(164); // a pixel of label 1: 100 + 64
    expect(image.data[0]).toBe(100); // a pixel of label 0: no offset
    expect(parseMasksRecord(saved)?.rows[1]?.height).toBe(1);
  });

  it('R83 a tagged working Height is not its own base: the bake starts from the tag, so an offset is never applied twice', async () => {
    const { view, commits } = setup(state(true), record([0, 1]));
    await ready(view);
    await act(async () => { view.result.current.onRowHeight(1, 0.5); });
    await waitFor(() => expect(commits).toHaveLength(1));
    const height = commits[0]!.commit.height as { image: PixelImage; offsetBase: string };
    expect(height.offsetBase).toBe('hb');
    expect(height.image.data[7]).toBe(132); // 100 + 32, not 164 + 32
  });

  it('R83 a base file that is gone is dropped: the commit takes the current working Height as the new base', async () => {
    const { view, commits } = setup(state(true), record([0, 1]), ['hb']);
    await ready(view);
    await act(async () => { view.result.current.onRowHeight(1, 0.5); });
    await waitFor(() => expect(commits).toHaveLength(1));
    const height = commits[0]!.commit.height as { image: PixelImage; offsetBase: string };
    expect(height.offsetBase).toBe('h1');
    expect(height.image.data[7]).toBe(196); // 164 + 32
  });

  it('R84 when the last offset returns to 0 the working Height goes back to the base itself, with no bake of rough or metal', async () => {
    const { view, commits } = setup(state(true), record([0, 1]));
    await ready(view);
    await act(async () => { view.result.current.onRowHeight(1, 0); });
    await waitFor(() => expect(commits).toHaveLength(1));
    expect(commits[0]!.commit.height).toEqual({ backTo: 'hb' });
    expect(commits[0]!.commit.bake).toBeUndefined();
  });

  it('R83 R84 with every offset at 0 and an untagged Height, a commit writes nothing to Height', async () => {
    const { view, commits } = setup(state(false), record());
    await ready(view);
    await act(async () => { view.result.current.onRowRough(1, 0.5); });
    await waitFor(() => expect(commits).toHaveLength(1));
    expect(commits[0]!.commit.height).toBeUndefined();
  });

  it('R85 a roughness commit never writes Height, even while offsets are set', async () => {
    const { view, commits } = setup(state(true), record([0, 1]));
    await ready(view);
    await act(async () => { view.result.current.onRowRough(1, 0.5); });
    await waitFor(() => expect(commits).toHaveLength(1));
    expect(commits[0]!.commit.bake).toBeDefined();
    expect(commits[0]!.commit.height).toBeUndefined();
  });

  it('R85 a feather change writes Height too while an offset is set, and not when every offset is 0', async () => {
    const withOffset = setup(state(true), record([0, 1]));
    await ready(withOffset.view);
    await act(async () => { withOffset.view.result.current.onFeather(2); });
    await waitFor(() => expect(withOffset.commits).toHaveLength(1));
    expect(withOffset.commits[0]!.commit.bake).toBeDefined();
    expect(withOffset.commits[0]!.commit.height).toMatchObject({ offsetBase: 'hb' });
    const plain = setup(state(false), record());
    await ready(plain.view);
    await act(async () => { plain.view.result.current.onFeather(2); });
    await waitFor(() => expect(plain.commits).toHaveLength(1));
    expect(plain.commits[0]!.commit.height).toBeUndefined();
  });

  it('R86 Reset all sets every offset to 0 and sends the Height back to its base in the same commit', async () => {
    const { view, commits } = setup(state(true), record([0.4, 1]));
    await ready(view);
    await act(async () => { view.result.current.onResetAll(); });
    await waitFor(() => expect(commits).toHaveLength(1));
    expect(commits[0]!.commit.height).toEqual({ backTo: 'hb' });
    expect(parseMasksRecord(commits[0]!.record)?.rows.map((row) => row.height)).toEqual([0, 0]);
  });

  it('R86 choosing another base material leaves the offset as it is', async () => {
    const { view, commits } = setup(state(true), record([0, 1]));
    await ready(view);
    await act(async () => { view.result.current.onRowMaterial(1, 'Brick'); });
    await waitFor(() => expect(commits).toHaveLength(1));
    expect(parseMasksRecord(commits[0]!.record)?.rows[1]?.height).toBe(1);
    expect(commits[0]!.commit.height).toBeUndefined();
  });

  it('R81 a height value with no Height map is saved in the record but writes no map', async () => {
    const maps: MapsState = { size: TINY, maps: { albedo: state(false).maps.albedo!, labels: state(false).maps.labels! } };
    const { view, commits } = setup(maps, record());
    await ready(view);
    await act(async () => { view.result.current.onRowHeight(1, 0.5); });
    await waitFor(() => expect(commits).toHaveLength(1));
    expect(commits[0]!.commit.height).toBeUndefined();
    expect(parseMasksRecord(commits[0]!.record)?.rows[1]?.height).toBe(0.5);
  });
});
