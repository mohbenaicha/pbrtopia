// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExportJob } from '@mat/export';
import type { MapRecord, MapsState, PixelImage } from '@mat/maps';
import { useExportDialog, type ExportDialogDeps } from '../../../../../src/materialgen/app/panels/export/useExportDialog';

const record = (key: string): MapRecord => ({ originalKey: key, workingKey: `w-${key}`, undoKey: null, width: 1024, height: 1024 });
const full = (): MapsState => ({ size: 1024, maps: { albedo: record('a'), normal: record('n'), height: record('h'), rough: record('r'), metal: record('m'), ao: record('o') } });
afterEach(cleanup);
const preview = { tilingX: 2, tilingY: 3, heightScale: 0.05, heightLevel: 0.4, heightContrast: 1 };

function setup(state: MapsState = full(), patch: Partial<ExportDialogDeps> = {}) {
  const memory: Record<string, string> = {};
  const saved: Array<{ name: string; size: number }> = [];
  const jobs: ExportJob[] = [];
  const deps: ExportDialogDeps = {
    startExport: async (job) => {
      jobs.push(job);
      return { bytes: new Uint8Array(2 * 1024 * 1024), fileName: `${job.plan.name}.zip` };
    },
    saveFile: (blob, name) => saved.push({ name, size: blob.size }),
    storage: { getItem: (key) => memory[key] ?? null, setItem: (key, value) => void (memory[key] = value) },
    now: () => '2026-11-10T12:00:00.000Z',
    ...patch,
  };
  const readBlob = vi.fn(async (key: string) => new Blob([key]));
  const view = renderHook(() => useExportDialog({ projectName: 'Mossy bricks', colorMode: 'albedo', state, preview, masksRecord: undefined, readBlob, deps }));
  return { view, jobs, saved, readBlob, memory };
}

describe('materialgen/export R20 R21 the dialog options', () => {
  it('R20 R21 opens on Blender, separate files, height and ao on, masks off, at the project size', () => {
    const { view } = setup();
    act(() => view.result.current.show());
    expect(view.result.current.open).toBe(true);
    expect(view.result.current.options).toEqual({ target: 'blender', packing: 'separate', includeHeight: true, includeAo: true, includeMasks: false, size: 1024 });
    expect(view.result.current.plan.files.map((file) => file.fileName)).toEqual(['albedo.png', 'normal.png', 'height.png', 'roughness.png', 'metallic.png', 'ao.png']);
  });

  it('R21 the file list follows the options', () => {
    const { view } = setup();
    act(() => view.result.current.show());
    act(() => view.result.current.setOptions({ packing: 'packed', includeHeight: false }));
    expect(view.result.current.plan.files.map((file) => file.fileName)).toEqual(['albedo.png', 'normal.png', 'orm.png']);
  });

  it('R21 Include height, Include ambient occlusion and Include material masks are disabled when their map is absent', () => {
    const state = full();
    delete state.maps.height;
    delete state.maps.ao;
    const { view } = setup(state);
    act(() => view.result.current.show());
    expect(view.result.current.disabled).toEqual({ includeHeight: true, includeAo: true, includeMasks: true, includeEmissive: true });
  });

  it('R22 the size choices are the project size and smaller', () => {
    const { view } = setup();
    expect(view.result.current.sizeChoices).toEqual([1024, 512, 256]);
  });

  it('R20 each card lists the file names it would write', () => {
    const { view } = setup();
    expect(view.result.current.cardFiles.substance[0]).toBe('Mossy bricks_BaseColor.png');
    expect(view.result.current.cardFiles.blender).toContain('build_material.py');
  });

  it('R36 Export is not allowed when no map exists', () => {
    const { view } = setup({ size: null, maps: {} });
    expect(view.result.current.canExport).toBe(false);
  });
});

describe('materialgen/export R29 R31 R33 R34 running an export', () => {
  it('R29 reads the files when Export is pressed, hands the worker the job, saves <Name>.zip and shows the message', async () => {
    const { view, jobs, saved, readBlob, memory } = setup();
    act(() => view.result.current.show());
    act(() => view.result.current.setOptions({ target: 'maya' }));
    expect(readBlob).not.toHaveBeenCalled();
    await act(async () => view.result.current.start());
    expect(readBlob).toHaveBeenCalledTimes(6);
    expect(jobs[0]).toMatchObject({ exportedAt: '2026-11-10T12:00:00.000Z', projectName: 'Mossy bricks', preview: { tilingX: 2, tilingY: 3, heightScale: 0.05, heightLevel: 0.4 }, script: { fileName: 'import_material.py' } });
    expect(saved).toEqual([{ name: 'Mossy bricks.zip', size: 2 * 1024 * 1024 }]);
    expect(view.result.current.message).toBe('Exported Mossy bricks.zip (2.0 MB)');
    expect(view.result.current.open).toBe(false);
    expect(Object.values(memory)).toEqual(['maya']);
  });

  it('R33 a failure stays in the dialog with the message, and Try again runs it again', async () => {
    let calls = 0;
    const { view, saved } = setup(full(), { startExport: async (job) => { calls += 1; if (calls === 1) throw new Error('Normal: the file cannot be read, so nothing was exported.'); return { bytes: new Uint8Array(1), fileName: `${job.plan.name}.zip` }; } });
    act(() => view.result.current.show());
    await act(async () => view.result.current.start());
    expect(view.result.current.phase).toBe('failed');
    expect(view.result.current.error).toMatch(/Normal/);
    expect(view.result.current.open).toBe(true);
    await act(async () => view.result.current.start());
    expect(view.result.current.open).toBe(false);
    expect(saved).toHaveLength(1);
  });

  it('R33 a file that cannot be read fails before the worker starts', async () => {
    const startExport = vi.fn();
    const gone = renderHook(() => useExportDialog({ projectName: 'x', colorMode: 'albedo', state: full(), preview, masksRecord: undefined, readBlob: async (key) => (key === 'w-n' ? null : new Blob([key])), deps: { startExport, saveFile: vi.fn(), storage: { getItem: () => null, setItem: () => undefined }, now: () => 'x' } }));
    act(() => gone.result.current.show());
    await act(async () => gone.result.current.start());
    expect(gone.result.current.error).toMatch(/normal/i);
    expect(startExport).not.toHaveBeenCalled();
  });

  it('R33 Cancel returns to the options with the same choices and downloads nothing', async () => {
    const { view, saved } = setup(full(), { startExport: (_job, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('stop'), { name: 'AbortError' })))) });
    act(() => view.result.current.show());
    act(() => view.result.current.setOptions({ packing: 'packed' }));
    let running: Promise<void> = Promise.resolve();
    act(() => { running = view.result.current.start(); });
    await vi.waitFor(() => expect(view.result.current.phase).toBe('running'));
    act(() => view.result.current.cancel());
    await act(async () => running);
    expect(view.result.current.phase).toBe('options');
    expect(view.result.current.options.packing).toBe('packed');
    expect(saved).toEqual([]);
    expect(view.result.current.open).toBe(true);
  });

  it('R33 leaving the project while an export runs ends it', async () => {
    let signal: AbortSignal | undefined;
    const { view } = setup(full(), { startExport: (_job, io) => { signal = io.signal; return new Promise(() => undefined); } });
    act(() => view.result.current.show());
    act(() => { void view.result.current.start(); });
    await vi.waitFor(() => expect(signal).toBeDefined());
    view.unmount();
    expect(signal!.aborted).toBe(true);
  });

  it('R33 no progress bar is left over after a cancel', async () => {
    const { view } = setup(full(), { startExport: (_job, io) => new Promise((_resolve, reject) => { io.onProgress({ text: 'Encoding normal', done: 3, total: 6 }); io.signal.addEventListener('abort', () => reject(Object.assign(new Error('stop'), { name: 'AbortError' }))); }) });
    act(() => view.result.current.show());
    let running: Promise<void> = Promise.resolve();
    act(() => { running = view.result.current.start(); });
    await vi.waitFor(() => expect(view.result.current.phase).toBe('running'));
    act(() => view.result.current.cancel());
    await act(async () => running);
    expect(view.result.current.progress).toBeNull();
  });

  it('R20 closing the dialog leaves the message empty and the choices for next time', () => {
    const { view } = setup();
    act(() => view.result.current.show());
    act(() => view.result.current.close());
    expect(view.result.current.open).toBe(false);
    expect(view.result.current.message).toBeNull();
  });
});

// Export R37, R42, R43: the emissive map is one in-memory plane that lives only as long as the export dialog does.
const maskRow = (label: number, name: string) => ({ label, name, description: '', location: '', defaultMaterial: 'Brick', top3: ['Brick'], matchKind: 'keyword', material: 'Brick', rough: 0.8, metal: 0, height: 0 });
const masksRecord = { source: 'model', feather: 0, palette: [{ label: 0, hex: '#FF0000', name: 'red' }], rows: [maskRow(0, 'Wall')] };
const plane = (fill: number): PixelImage => ({ width: 4, height: 4, channels: 1, data: new Uint8Array(16).fill(fill) });

function setupEmissive(patch: Partial<ExportDialogDeps> = {}, withMasks = true) {
  const jobs: ExportJob[] = [];
  const deps: ExportDialogDeps = {
    startExport: async (job) => { jobs.push(job); return { bytes: new Uint8Array(8), fileName: 'x.zip' }; },
    saveFile: vi.fn(), storage: { getItem: () => null, setItem: () => undefined }, now: () => 'x', ...patch,
  };
  const state: MapsState = { size: 1024, maps: { ...full().maps, ...(withMasks ? { labels: record('l') } : {}) } };
  const view = renderHook(() => useExportDialog({ projectName: 'Mossy bricks', colorMode: 'albedo', state, preview, masksRecord: withMasks ? (masksRecord as never) : undefined, readBlob: async (key) => new Blob([key]), deps }));
  act(() => view.result.current.show());
  return { view, jobs };
}
type EmissiveView = ReturnType<typeof setupEmissive>['view'];
const hasPlane = (view: EmissiveView): boolean => view.result.current.emissive.plane !== null;
const confirmPlane = (view: EmissiveView, fill = 255): void => {
  act(() => view.result.current.emissive.ask());
  act(() => view.result.current.emissive.confirm(plane(fill)));
};

describe('materialgen/export R37 the Create emissive map option', () => {
  it('R37 it is off by default, disabled without a labels map or a masks record, enabled with both', () => {
    expect(setupEmissive({}, false).view.result.current.disabled.includeEmissive).toBe(true);
    const { view } = setupEmissive();
    expect(view.result.current.disabled.includeEmissive).toBe(false);
    expect(view.result.current.emissive.plane).toBeNull();
    expect(view.result.current.emissive.asking).toBe(false);
  });

  it('R37 asking opens the emissive dialog but changes nothing; Cancel leaves no plane and the list unchanged', () => {
    const { view } = setupEmissive();
    act(() => view.result.current.emissive.ask());
    expect(view.result.current.emissive.asking).toBe(true);
    expect(view.result.current.plan.files.map((file) => file.fileName)).not.toContain('emissive.png');
    act(() => view.result.current.emissive.cancelAsk());
    expect(view.result.current.emissive).toMatchObject({ asking: false, plane: null });
  });

  it('R37 R41 Confirm keeps the plane, closes the question and lists emissive.png after ao', () => {
    const { view } = setupEmissive();
    confirmPlane(view);
    expect(view.result.current.emissive.asking).toBe(false);
    expect(view.result.current.plan.files.map((file) => file.fileName)).toEqual(['albedo.png', 'normal.png', 'height.png', 'roughness.png', 'metallic.png', 'ao.png', 'emissive.png']);
  });

  it('R37 asking is refused while an export runs', async () => {
    const { view } = setupEmissive({ startExport: () => new Promise(() => undefined) });
    act(() => { void view.result.current.start(); });
    await vi.waitFor(() => expect(view.result.current.phase).toBe('running'));
    act(() => view.result.current.emissive.ask());
    expect(view.result.current.emissive.asking).toBe(false);
  });

  it('R37 the options the dialog reports keep their shape: the emissive choice is the plane itself', () => {
    const { view } = setupEmissive();
    expect(view.result.current.options).toEqual({ target: 'blender', packing: 'separate', includeHeight: true, includeAo: true, includeMasks: false, size: 1024 });
  });
});

describe('materialgen/export R42 one working copy', () => {
  it('R42 a second plane replaces the first', () => {
    const { view } = setupEmissive();
    confirmPlane(view, 255);
    confirmPlane(view, 7);
    expect(view.result.current.emissive.plane!.data[0]).toBe(7);
  });

  it('R42 the job gets a copy: the worker cannot change the plane the dialog keeps', async () => {
    const { view } = setupEmissive({ startExport: async (job) => { job.emissive!.data.fill(0); throw new Error('stop'); } });
    confirmPlane(view, 255);
    await act(async () => view.result.current.start());
    expect(view.result.current.emissive.plane!.data[0]).toBe(255);
  });

  it('R42 the plane is not read from storage: only the stored maps are read', async () => {
    const { view, jobs } = setupEmissive();
    confirmPlane(view);
    await act(async () => view.result.current.start());
    expect(jobs[0]!.emissive!.data[0]).toBe(255);
    expect(Object.keys(jobs[0]!.files)).not.toContain('emissive');
  });
});

describe('materialgen/export R43 teardown', () => {
  it('R43 turning the option off drops the plane', () => {
    const { view } = setupEmissive();
    confirmPlane(view);
    act(() => view.result.current.emissive.drop());
    expect(hasPlane(view)).toBe(false);
    expect(view.result.current.plan.files.map((file) => file.fileName)).not.toContain('emissive.png');
  });

  it('R43 closing the export dialog drops it, and opening it again starts without one', () => {
    const { view } = setupEmissive();
    confirmPlane(view);
    act(() => view.result.current.close());
    expect(hasPlane(view)).toBe(false);
    act(() => view.result.current.show());
    expect(hasPlane(view)).toBe(false);
  });

  it('R43 showing the dialog again also clears a plane and a pending question', () => {
    const { view } = setupEmissive();
    confirmPlane(view);
    act(() => view.result.current.emissive.ask());
    act(() => view.result.current.show());
    expect(view.result.current.emissive).toMatchObject({ asking: false, plane: null });
  });

  it('R43 Cancel export while it runs drops it, keeps the other choices, and nothing is downloaded', async () => {
    const { view } = setupEmissive({ startExport: (_job, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('stop'), { name: 'AbortError' })))) });
    act(() => view.result.current.setOptions({ packing: 'packed' }));
    confirmPlane(view);
    let running: Promise<void> = Promise.resolve();
    act(() => { running = view.result.current.start(); });
    await vi.waitFor(() => expect(view.result.current.phase).toBe('running'));
    act(() => view.result.current.cancel());
    await act(async () => running);
    expect(hasPlane(view)).toBe(false);
    expect(view.result.current.options.packing).toBe('packed');
    expect(view.result.current.open).toBe(true);
  });

  it('R43 a finished export drops it, after the zip was handed to the download', async () => {
    const order: string[] = [];
    const { view } = setupEmissive({ saveFile: () => { order.push('saved'); } });
    confirmPlane(view);
    await act(async () => view.result.current.start());
    order.push(hasPlane(view) ? 'kept' : 'dropped');
    expect(order).toEqual(['saved', 'dropped']);
  });

  it('R43 a failed export keeps it for Try again, and Try again exports it', async () => {
    let calls = 0;
    const { view, jobs } = setupEmissive({ startExport: async (job) => { calls += 1; if (calls === 1) throw new Error('boom'); jobs.push(job); return { bytes: new Uint8Array(1), fileName: 'x.zip' }; } });
    confirmPlane(view);
    await act(async () => view.result.current.start());
    expect(view.result.current.phase).toBe('failed');
    expect(hasPlane(view)).toBe(true);
    await act(async () => view.result.current.start());
    expect(jobs[0]!.plan.files.map((file) => file.kind)).toContain('emissive');
    expect(hasPlane(view)).toBe(false);
  });
});
