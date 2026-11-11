// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { unzipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadMaterialZip, useMaterialExport, useMaterialImport } from '@mat/app/project/materialZipTransfer';
import { createTestMaterialStore } from '../../storage/materialStoreFixtures';

afterEach(cleanup);

const file = Object.assign(new File(['zip'], 'x.zip', { type: 'application/zip' }), { stream: () => new ReadableStream<Uint8Array>() });

describe('materialgen/app zip transfer', () => {
  it('R37 Export project downloads <project name>.zip as a "Material project" holding a manifest for this app', async () => {
    const { store } = await createTestMaterialStore();
    const made = await store.createProject({ name: 'Bricks / 2', size: 256 });
    if (!made.ok) throw new Error('setup');
    const saved: { blob: Blob; name: string }[] = [];
    const result = await downloadMaterialZip(store, { id: made.value.id, name: made.value.name }, { saveBlob: (blob, name) => void saved.push({ blob, name }) });
    expect(result.ok).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.name).toBe('Bricks _ 2.zip');
    const entries = unzipSync(new Uint8Array(await saved[0]!.blob.arrayBuffer()));
    expect(Object.keys(entries)).toEqual(expect.arrayContaining(['manifest.json', 'project.json']));
    expect(JSON.parse(new TextDecoder().decode(entries['manifest.json']))).toMatchObject({ app: 'app-material-lab', projectId: made.value.id });
  });

  it('R37 the picker is told the file description "Material project"', async () => {
    const { store } = await createTestMaterialStore();
    const made = await store.createProject({ name: 'Bricks', size: null });
    if (!made.ok) throw new Error('setup');
    const seen: string[] = [];
    await downloadMaterialZip(store, { id: made.value.id, name: 'Bricks' }, { showSaveFilePicker: async (options) => (seen.push(options.types[0]!.description), Promise.reject(new DOMException('c', 'AbortError'))), saveBlob: vi.fn() });
    expect(seen).toEqual(['Material project']);
  });

  it('R33 R37 the waiting save is written before the zip is made', async () => {
    const order: string[] = [];
    const flush = vi.fn(async () => (order.push('flush'), { ok: true as const, value: undefined }));
    const download = vi.fn(async () => (order.push('download'), { ok: true as const, value: undefined }));
    const { result } = renderHook(() => useMaterialExport({} as never, { id: 'p', name: 'P' }, flush, download));
    await act(() => result.current.start());
    expect(order).toEqual(['flush', 'download']);
    expect(result.current.error).toBeNull();
  });

  it('R33 a failed save before export stops the export and reports the failure', async () => {
    const flush = vi.fn(async () => ({ ok: false as const, error: { code: 'quota-exceeded' as const, message: 'Full.' } }));
    const download = vi.fn();
    const { result } = renderHook(() => useMaterialExport({} as never, { id: 'p', name: 'P' }, flush, download));
    await act(() => result.current.start());
    expect(download).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Full.');
  });

  it('R37 a project that is not open yet cannot be exported', async () => {
    const download = vi.fn();
    const { result } = renderHook(() => useMaterialExport({} as never, null, vi.fn(), download));
    await act(() => result.current.start());
    expect(download).not.toHaveBeenCalled();
  });

  it('R38 Import project reads the zip for this app id and names the project it made', async () => {
    const importZip = vi.fn(async () => ({ ok: true as const, value: { name: 'Bricks' } as never }));
    const { result } = renderHook(() => useMaterialImport({} as never, undefined, importZip));
    await act(() => result.current.start(file));
    expect(importZip).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.any(Function), { appId: 'material-lab', estimateFreeBytes: expect.any(Function) }); // app R36: the quota check runs on the unzipped size
    expect(result.current.message).toBe('Imported Bricks.');
  });
});
