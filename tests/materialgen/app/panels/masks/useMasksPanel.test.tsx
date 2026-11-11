// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PixelImage } from '@mat/imageops';
import type { MapsState, MasksCommit } from '@mat/maps';
import { encodePng } from '@mat/maps/png/pngCodec';
import { parseBaseMaterials, parseMasksRecord, type MasksRecord } from '@mat/masks';
import { useMasksPanel, type MasksPanelPorts } from '../../../../../src/materialgen/app/panels/masks/useMasksPanel';

const jobs = vi.hoisted(() => ({ failing: false }));
vi.mock('@mat/masks/worker/startMaskJob', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mat/masks/worker/startMaskJob')>();
  return { ...original, startMaskJob: ((...args: Parameters<typeof original.startMaskJob>) => (jobs.failing ? Promise.reject(new Error('worker stopped')) : original.startMaskJob(...args))) as typeof original.startMaskJob };
});

const table = parseBaseMaterials({ Brick: [0.8, 0, [160, 60, 40]], Steel: [0.3, 1, [200, 200, 205]] });
const png = (image: PixelImage): Blob => new Blob([encodePng(image) as BlobPart], { type: 'image/png' });
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

const albedoState = (): MapsState => ({ size: 256, maps: { albedo: { originalKey: 'a', workingKey: 'a', undoKey: null, width: 8, height: 8 } } });
const TINY_SIZE = 8 as unknown as MapsState['size']; // the pictures of these tests are 8 x 8, so S is 8 too (not an allowed size, which is fine here)
const maskedState = (derivedAlbedoKey = 'a', size: MapsState['size'] = TINY_SIZE): MapsState => ({
  size,
  maps: { ...albedoState().maps, labels: { originalKey: 'l', workingKey: 'l', undoKey: null, width: 8, height: 8, derivedFrom: { kind: 'albedo', key: derivedAlbedoKey } } },
});
const storedRecord = (): MasksRecord => ({
  source: 'model',
  palette: [{ label: 0, hex: '#FF0000', name: 'red' }, { label: 1, hex: '#00FF00', name: 'green' }],
  feather: 0,
  rows: [
    { label: 0, name: 'Wall', description: '', location: '', defaultMaterial: 'Brick', top3: ['Brick'], matchKind: 'colour', material: 'Brick', rough: 0.8, metal: 0 },
    { label: 1, name: 'Plate', description: '', location: '', defaultMaterial: 'Steel', top3: ['Steel'], matchKind: 'colour', material: 'Steel', rough: 0.3, metal: 1 },
  ],
});

function setup(state: MapsState, masks?: MasksRecord | undefined, overrides: Partial<MasksPanelPorts> = {}) {
  const blobs = new Map<string, Blob>([['a', png(twoColours())], ['l', png(halves())]]);
  const commits: Array<{ commit: MasksCommit; record: Record<string, unknown> }> = [];
  const commitMasks = vi.fn(async (commit: MasksCommit, record: Record<string, unknown>) => (commits.push({ commit, record }), true));
  const refuse = vi.fn();
  const ports: MasksPanelPorts = {
    state, masksRecord: masks === undefined ? undefined : (masks as unknown as Record<string, unknown>), canWrite: true,
    controller: { commitMasks, refuse }, readBlob: async (key) => blobs.get(key) ?? null, loadTable: async () => table,
    model: { disabledReason: 'off', running: false, error: null, canRetry: false, modelNames: '', onCreate: vi.fn(), onRerun: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn() }, ...overrides,
  };
  const view = renderHook(() => useMasksPanel(ports));
  return { view, commits, commitMasks, refuse };
}

describe('materialgen/app useMasksPanel', () => {
  it('R34 the base materials are loaded when the panel is used, and a failed load is said so', async () => {
    const ok = setup(albedoState());
    await waitFor(() => expect(ok.view.result.current.table).not.toBeNull());
    const failed = setup(albedoState(), undefined, { loadTable: async () => { throw new Error('gone'); } });
    await waitFor(() => expect(failed.view.result.current.tableProblem).not.toBeNull());
    expect(failed.view.result.current.table).toBeNull();
  });

  it('R50 a released roughness value bakes and commits the record with that value, without new labels', async () => {
    const { view, commits } = setup(maskedState(), storedRecord());
    await waitFor(() => expect(view.result.current.table).not.toBeNull());
    await act(async () => { view.result.current.onRowRough(1, 0.5); });
    await waitFor(() => expect(commits).toHaveLength(1));
    const { commit, record } = commits[0]!;
    expect(commit.labels).toBeUndefined();
    expect(commit.label).toBe('Material masks');
    expect(parseMasksRecord(record)?.rows[1]?.rough).toBe(0.5);
    const rough = commit.bake!.rough.data;
    expect(rough[7]).toBe(Math.round(0.5 * 255)); // a pixel of label 1
    expect(rough[0]).toBe(Math.round(0.8 * 255)); // a pixel of label 0
  });

  it('R79 a row change after the size changed, with no stored picture to rebuild the labels from, refuses and commits nothing', async () => {
    const { view, commits, refuse } = setup(maskedState('a', 256), storedRecord());
    await waitFor(() => expect(view.result.current.table).not.toBeNull());
    await act(async () => { view.result.current.onRowRough(1, 0.5); });
    await waitFor(() => expect(refuse).toHaveBeenCalledWith(expect.stringContaining('decomposition')));
    expect(commits).toHaveLength(0);
  });

  it('R50 a row change gives back a promise that settles when the bake is stored, so the slider can keep its value until then', async () => {
    const { view, commits } = setup(maskedState(), storedRecord());
    await waitFor(() => expect(view.result.current.table).not.toBeNull());
    let pending: unknown;
    await act(async () => { pending = view.result.current.onRowRough(1, 0.5); });
    expect(pending).toBeInstanceOf(Promise);
    await expect(pending).resolves.toBe(true);
    expect(commits).toHaveLength(1);
  });

  it('R40 choosing another base material replaces the row values with its own', async () => {
    const { view, commits } = setup(maskedState(), storedRecord());
    await waitFor(() => expect(view.result.current.table).not.toBeNull());
    await act(async () => { view.result.current.onRowMaterial(0, 'Steel'); });
    await waitFor(() => expect(commits).toHaveLength(1));
    const row = parseMasksRecord(commits[0]!.record)!.rows[0]!;
    expect([row.material, row.rough, row.metal]).toEqual(['Steel', 0.3, 1]);
  });

  it('R53 Reset all returns every row to its matched material in one commit; the feather stays', async () => {
    const changed = storedRecord();
    changed.rows[0] = { ...changed.rows[0]!, rough: 0.1 };
    changed.feather = 3;
    const { view, commits } = setup(maskedState(), changed);
    await waitFor(() => expect(view.result.current.table).not.toBeNull());
    await act(async () => { view.result.current.onResetAll(); });
    await waitFor(() => expect(commits).toHaveLength(1));
    const saved = parseMasksRecord(commits[0]!.record)!;
    expect(saved.rows[0]!.rough).toBe(0.8);
    expect(saved.feather).toBe(3);
  });

  it('R54 a feather change re-bakes with the saved rows', async () => {
    const { view, commits } = setup(maskedState(), storedRecord());
    await waitFor(() => expect(view.result.current.table).not.toBeNull());
    await act(async () => { view.result.current.onFeather(2); });
    await waitFor(() => expect(commits).toHaveLength(1));
    expect(parseMasksRecord(commits[0]!.record)?.feather).toBe(2);
  });

  it('R59 labels made from another albedo are stale, and labels made from this one are not', async () => {
    const stale = setup(maskedState('older'), storedRecord());
    expect(stale.view.result.current.stale).toBe(true);
    const fresh = setup(maskedState('a'), storedRecord());
    expect(fresh.view.result.current.stale).toBe(false);
  });

  it('R12 nothing is committed in a read-only project and the panel says it is locked', async () => {
    const { view, commits } = setup(maskedState(), storedRecord(), { canWrite: false });
    await waitFor(() => expect(view.result.current.table).not.toBeNull());
    await act(async () => { view.result.current.onRowRough(0, 0.2); });
    expect(commits).toHaveLength(0);
    expect(view.result.current.canWrite).toBe(false);
  });

  it('R58 changes made while a bake runs are merged into one further bake', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let first = true;
    const { view, commits, commitMasks } = setup(maskedState(), storedRecord());
    commitMasks.mockImplementation(async (commit, record) => {
      if (first) { first = false; await gate; }
      commits.push({ commit, record });
      return true;
    });
    await waitFor(() => expect(view.result.current.table).not.toBeNull());
    await act(async () => { view.result.current.onRowRough(0, 0.1); });
    await act(async () => { view.result.current.onRowRough(0, 0.2); view.result.current.onRowMetal(1, 0.5); });
    release?.();
    await waitFor(() => expect(commits).toHaveLength(2));
    const last = parseMasksRecord(commits[1]!.record)!;
    expect([last.rows[0]!.rough, last.rows[1]!.metal]).toEqual([0.2, 0.5]);
  });
});

describe('materialgen/app useMasksPanel model source', () => {
  /** A decomposition picture in the stored record's palette colours (red, green): left half red, right half green. */
  const decomposition = (side = 16): PixelImage => {
    const data = new Uint8Array(side * side * 3);
    for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) data.set(x < side / 2 ? [255, 0, 0] : [0, 255, 0], (y * side + x) * 3);
    return { width: side, height: side, channels: 3, data };
  };
  const modelState = (keepsPicture: boolean): MapsState => ({
    size: 256,
    maps: { ...albedoState().maps, labels: { originalKey: keepsPicture ? 'orig' : 'l', workingKey: 'l', undoKey: null, width: keepsPicture ? 16 : 8, height: keepsPicture ? 16 : 8, derivedFrom: { kind: 'albedo', key: 'a' } } },
  });
  const modelRecord = storedRecord;
  const readFrom = (extra: Record<string, Blob>) => async (key: string) => ({ a: png(twoColours()), l: png(halves()), ...extra })[key] ?? null;

  it('R79 a row change after the size grew rebuilds a model source\'s labels from its stored picture at the new size, then bakes, in one commit', async () => {
    const { view, commits, refuse } = setup(modelState(true), modelRecord(), { readBlob: readFrom({ orig: png(decomposition()) }) });
    await waitFor(() => expect(view.result.current.table).not.toBeNull());
    await act(async () => { view.result.current.onRowRough(1, 0.5); });
    await waitFor(() => expect(commits).toHaveLength(1));
    const { commit, record } = commits[0]!;
    expect(refuse).not.toHaveBeenCalled();
    expect(commit.labels?.keepOriginal).toBe(true);
    expect(commit.labels?.working.width).toBe(256);
    expect(commit.bake?.rough.width).toBe(256);
    expect(parseMasksRecord(record)?.rows[1]?.rough).toBe(0.5);
  });

  it('R79 with no stored picture, a row change after the size grew refuses and keeps the labels as they were', async () => {
    const { view, commits, refuse } = setup(modelState(false), modelRecord());
    await waitFor(() => expect(view.result.current.table).not.toBeNull());
    await act(async () => { view.result.current.onRowRough(1, 0.5); });
    expect(commits).toHaveLength(0);
    expect(refuse).toHaveBeenCalledWith(expect.stringContaining('decomposition'));
  });

  describe('when the masks work fails (R24)', () => {
    beforeEach(() => { jobs.failing = true; });
    afterEach(() => { jobs.failing = false; });

    it('R24 a row change whose bake fails says so, stores nothing and answers false', async () => {
      const { view, commits, refuse } = setup(maskedState(), storedRecord());
      await waitFor(() => expect(view.result.current.table).not.toBeNull());
      let stored: unknown;
      await act(async () => { stored = await view.result.current.onRowRough(1, 0.5); });
      expect(stored).toBe(false);
      expect(refuse).toHaveBeenCalledWith(expect.stringContaining('Could not bake'));
      expect(commits).toHaveLength(0);
    });
  });
});
