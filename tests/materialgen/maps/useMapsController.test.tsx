// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { storeFailure, type StoreResult } from '../../../src/projects';
import { useMapsController, type MapsHost } from '../../../src/materialgen/maps/useMapsController';
import type { MapsState } from '../../../src/materialgen/maps';
import { encodePng, type PixelImage } from '../../../src/materialgen/maps/png/pngCodec';

const ok: StoreResult<void> = { ok: true, value: undefined };
const solid = (side: number, value: number): PixelImage => ({ width: side, height: side, channels: 3, data: new Uint8Array(side * side * 3).fill(value) });
const pngFile = (name: string, side = 256, value = 80): File => new File([encodePng(solid(side, value)) as BlobPart], name, { type: 'image/png' });
const textFile = (name: string): File => new File(['x'], name, { type: 'text/plain' });

function useFakeProject(overrides: Partial<MapsHost> = {}) {
  const [state, setState] = useState<MapsState>({ size: null, maps: {} });
  const files = useState(() => new Map<string, Blob>())[0];
  const counter = useState(() => ({ n: 0 }))[0];
  const saved: string[] = [];
  const commits = useState(() => [] as { next: MapsState; masks: Record<string, unknown> | undefined }[])[0];
  const host: MapsHost = {
    state,
    canWrite: true,
    projectName: 'Brick',
    colorMode: 'albedo',
    readBlob: async (key) => files.get(key) ?? null,
    writeBlob: async (key, blob) => (files.set(key, blob), ok),
    deleteBlob: async (key) => (files.delete(key), ok),
    commit: async (next, masks) => (commits.push({ next, masks }), setState(next), ok),
    otherReferencedKeys: () => new Set(),
    estimateFreeBytes: async () => null,
    newKey: () => `k${(counter.n += 1)}`,
    saveBlob: (_blob, name) => void saved.push(name),
    ...overrides,
  };
  return { host, files, saved, commits };
}

function setup(overrides: Partial<MapsHost> = {}) {
  const view = renderHook(() => {
    const project = useFakeProject(overrides);
    return { ...project, controller: useMapsController(project.host) };
  });
  return view;
}

describe('materialgen/maps R36 R41 R40 dropping files', () => {
  it('R36 a file dropped on an empty slot is placed, S is set and the record is committed', async () => {
    const { result } = setup();
    await act(() => result.current.controller.dropFiles('albedo', [pngFile('brick.png')]));
    expect(result.current.host.state.size).toBe(256);
    expect(result.current.host.state.maps.albedo).toMatchObject({ source: { kind: 'dropped', name: 'brick.png' } });
    expect(result.current.controller.message).toBeNull();
    expect(result.current.files.size).toBe(1);
  });

  it('R41 extra files are ignored and a notice says so', async () => {
    const { result } = setup();
    await act(() => result.current.controller.dropFiles('albedo', [pngFile('a.png'), pngFile('b.png')]));
    expect(result.current.controller.message).toEqual({ tone: 'notice', text: 'Used a.png; 1 other file(s) ignored.' });
  });

  it('R40 a file that is not an image writes nothing, changes nothing and says so', async () => {
    const decodeFile = vi.fn(async (file: File) => ({ ok: false as const, message: `${file.name} is not an image` }));
    const { result } = setup({ decodeFile });
    await act(() => result.current.controller.dropFiles('albedo', [textFile('notes.txt')]));
    expect(result.current.controller.message).toEqual({ tone: 'error', text: 'notes.txt is not an image' });
    expect(result.current.host.state).toEqual({ size: null, maps: {} });
    expect(result.current.files.size).toBe(0);
  });

  it('R37 a second drop on the same slot is an edit: the original stays and Undo becomes available', async () => {
    const { result } = setup();
    await act(() => result.current.controller.dropFiles('albedo', [pngFile('a.png')]));
    await act(() => result.current.controller.dropFiles('albedo', [pngFile('b.png', 256, 10)]));
    const map = result.current.host.state.maps.albedo!;
    expect(map.undoKey).not.toBeNull();
    expect(map.workingKey).not.toBe(map.originalKey);
    expect(result.current.files.size).toBe(2);
  });

  it('R43 a drop on a map that is still being written is refused as Busy', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { result } = setup({ commit: async () => (await gate, ok) });
    let first: Promise<void> = Promise.resolve();
    act(() => void (first = result.current.controller.dropFiles('albedo', [pngFile('a.png')])));
    await waitFor(() => expect(result.current.controller.busy.has('albedo')).toBe(true));
    await act(() => result.current.controller.dropFiles('albedo', [pngFile('b.png')]));
    expect(result.current.controller.message).toEqual({ tone: 'error', text: 'Busy' });
    release();
    await act(() => first);
    await waitFor(() => expect(result.current.controller.busy.size).toBe(0));
  });

  it('R71 the dropped picture is offered as pending while it is still being saved, and withdrawn once the committed record carries its key', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const { result } = setup({ writeBlob: async () => { await held; return ok; } });
    let drop: Promise<void> = Promise.resolve();
    act(() => void (drop = result.current.controller.dropFiles('albedo', [pngFile('a.png')])));
    await waitFor(() => expect(result.current.controller.pending.albedo).toBeDefined());
    expect(result.current.host.state.maps.albedo).toBeUndefined(); // nothing is committed yet
    expect(result.current.controller.pending.albedo!.image.width).toBe(256);
    release();
    await act(() => drop);
    await waitFor(() => expect(result.current.controller.pending.albedo).toBeUndefined());
    expect(result.current.host.state.maps.albedo).toBeDefined();
  });

  it('R71 a save that fails withdraws the pending picture, so the preview goes back to what it showed', async () => {
    const { result } = setup({ commit: async () => storeFailure('aborted', 'Could not save.') });
    await act(() => result.current.controller.dropFiles('albedo', [pngFile('a.png')]));
    expect(result.current.controller.pending).toEqual({});
    expect(result.current.controller.message?.tone).toBe('error');
  });

  it('R32 a read-only project refuses every change and says why', async () => {
    const { result } = setup({ canWrite: false });
    await act(() => result.current.controller.dropFiles('albedo', [pngFile('a.png')]));
    expect(result.current.controller.message?.text).toMatch(/another tab/);
    expect(result.current.files.size).toBe(0);
  });

  it('R29 a failed commit leaves the record as it was and removes the written file', async () => {
    const { result } = setup({ commit: async () => storeFailure('aborted', 'Could not save.') });
    await act(() => result.current.controller.dropFiles('albedo', [pngFile('a.png')]));
    expect(result.current.controller.message).toEqual({ tone: 'error', text: 'Could not save.' });
    expect(result.current.host.state).toEqual({ size: null, maps: {} });
    expect(result.current.files.size).toBe(0);
  });

  it('R67 not enough storage writes nothing and shows the quota message', async () => {
    const { result } = setup({ estimateFreeBytes: async () => 10 });
    await act(() => result.current.controller.dropFiles('albedo', [pngFile('a.png')]));
    expect(result.current.controller.message?.text).toMatch(/^Not enough storage: about /);
    expect(result.current.files.size).toBe(0);
  });
});

describe('materialgen/maps R18 R19 R20 R21 R48 other operations', () => {
  async function withDroppedTwice() {
    const view = setup();
    await act(() => view.result.current.controller.dropFiles('albedo', [pngFile('a.png')]));
    await act(() => view.result.current.controller.dropFiles('albedo', [pngFile('b.png', 256, 10)]));
    return view;
  }

  it('R18 undo returns the previous working map and deletes the undone file', async () => {
    const { result } = await withDroppedTwice();
    const before = result.current.host.state.maps.albedo!;
    await act(() => result.current.controller.undo(['albedo']));
    const after = result.current.host.state.maps.albedo!;
    expect(after.workingKey).toBe(before.undoKey);
    expect(after.undoKey).toBeNull();
    expect(result.current.files.has(before.workingKey)).toBe(false);
  });

  it('R30 undo of a map whose undo file is missing changes nothing and says "<map>: file missing"', async () => {
    const { result } = await withDroppedTwice();
    const before = result.current.host.state;
    result.current.files.delete(before.maps.albedo!.undoKey!);
    await act(() => result.current.controller.undo(['albedo']));
    expect(result.current.host.state).toBe(before);
    expect(result.current.files.has(before.maps.albedo!.workingKey)).toBe(true); // the only good copy is kept
    expect(result.current.controller.message).toEqual({ tone: 'error', text: 'Albedo: file missing' });
  });

  it('R19 restore original makes the original the working map again', async () => {
    const { result } = await withDroppedTwice();
    const original = result.current.host.state.maps.albedo!.originalKey;
    await act(() => result.current.controller.restoreOriginal('albedo'));
    expect(result.current.host.state.maps.albedo?.workingKey).toBe(original);
  });

  it('R20 clear removes the map, unsets S for the last map and deletes every file', async () => {
    const { result } = await withDroppedTwice();
    await act(() => result.current.controller.clear('albedo'));
    expect(result.current.host.state).toEqual({ size: null, maps: {} });
    expect(result.current.files.size).toBe(0);
  });

  it('R21 changing S resamples the working map into a new file and keeps the original', async () => {
    const { result } = await withDroppedTwice();
    const original = result.current.host.state.maps.albedo!.originalKey;
    await act(() => result.current.controller.changeSize(512));
    expect(result.current.host.state.size).toBe(512);
    expect(result.current.host.state.maps.albedo).toMatchObject({ originalKey: original, undo: { size: 256 } });
  });

  it('R48 download saves the working map under <Name>-<map>.png', async () => {
    const { result } = await withDroppedTwice();
    await act(() => result.current.controller.download('albedo'));
    expect(result.current.saved).toEqual(['Brick-albedo.png']);
  });

  it('R45 a map without a working copy has nothing to download', async () => {
    const { result } = setup();
    await act(() => result.current.controller.download('height'));
    expect(result.current.saved).toEqual([]);
  });
});

describe('materialgen/maps R16 R29 applying imageops results', () => {
  it('R16 R29 applyEdits writes the new file, commits the record and keeps the old file as undo', async () => {
    const { result } = setup();
    await act(() => result.current.controller.dropFiles('albedo', [pngFile('brick.png')]));
    const before = result.current.host.state.maps.albedo!.workingKey;
    let applied = false;
    await act(async () => { applied = await result.current.controller.applyEdits([{ kind: 'albedo', image: solid(256, 200) }], 'Filter', false); });
    expect(applied).toBe(true);
    const map = result.current.host.state.maps.albedo!;
    expect(map.workingKey).not.toBe(before);
    expect(map.undoKey).toBe(before);
    expect(map.undo?.label).toBe('Filter');
    expect(result.current.files.has(map.workingKey)).toBe(true);
    expect(result.current.files.has(before)).toBe(true);
  });

  it('R12 a failed commit reports false, changes nothing and leaves a message', async () => {
    const commit = vi.fn(async (): Promise<StoreResult<void>> => storeFailure('storage-unavailable', 'Disk full'));
    const { result } = setup({ commit });
    await act(() => result.current.controller.dropFiles('albedo', [pngFile('a.png')]));
    let applied = true;
    await act(async () => { applied = await result.current.controller.applyEdits([{ kind: 'albedo', image: solid(256, 200) }], 'Filter', false); });
    expect(applied).toBe(false);
    expect(result.current.controller.message?.tone).toBe('error');
  });

  it('R47 commitMasks stores the labels, the baked maps and the masks record together, and keeps the masks record with the commit', async () => {
    const { result } = setup();
    await act(() => result.current.controller.dropFiles('albedo', [pngFile('brick.png')]));
    const albedoKey = result.current.host.state.maps.albedo!.workingKey;
    const grey = (value: number): PixelImage => ({ width: 4, height: 4, channels: 1, data: new Uint8Array(16).fill(value) });
    let stored = false;
    await act(async () => {
      stored = await result.current.controller.commitMasks(
        { labels: { working: grey(1), derivedFrom: { kind: 'albedo', key: albedoKey } }, bake: { rough: grey(50), metal: grey(0) }, label: 'Material masks' },
        { source: 'model' },
      );
    });
    expect(stored).toBe(true);
    const last = result.current.commits.at(-1)!;
    expect(Object.keys(last.next.maps).sort()).toEqual(['albedo', 'labels', 'metal', 'rough']);
    expect(last.masks).toEqual({ source: 'model' });
    expect(result.current.files.size).toBe(4);
  });

  it('R47 commitMasks with only a record change writes no file', async () => {
    const { result } = setup();
    let stored = false;
    await act(async () => { stored = await result.current.controller.commitMasks({ label: 'Material masks' }, { components: [] }); });
    expect(stored).toBe(true);
    expect(result.current.commits.at(-1)!.masks).toEqual({ components: [] });
    expect(result.current.files.size).toBe(0);
  });

  it('R12 commitMasks is refused in a read-only project and reports false', async () => {
    const { result } = setup({ canWrite: false });
    let stored = true;
    await act(async () => { stored = await result.current.controller.commitMasks({ label: 'Material masks' }, {}); });
    expect(stored).toBe(false);
    expect(result.current.controller.message?.text).toContain('another tab');
  });

  it('R16 applyEdits is refused with a message when the project is read-only', async () => {
    const { result } = setup({ canWrite: false });
    let applied = true;
    await act(async () => { applied = await result.current.controller.applyEdits([{ kind: 'albedo', image: solid(256, 1) }], 'Filter', false); });
    expect(applied).toBe(false);
    expect(result.current.controller.message?.text).toContain('another tab');
  });
});
