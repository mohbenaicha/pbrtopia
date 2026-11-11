// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { storeFailure, type StoreResult } from '../../src/projects';
import { useProjectZipImport, type RunProjectImport } from '../../src/shell';

afterEach(cleanup);

type Imported = { id: string; name: string };
const file = Object.assign(new File(['zip'], 'helmet.zip', { type: 'application/zip' }), { stream: () => new ReadableStream<Uint8Array>() }); // jsdom's File has no stream()
const imported: Imported = { id: 'new-1', name: 'Helmet' };

describe('useProjectZipImport', () => {
  it('materialgen-prep R62 progress follows the run function and the result line names the project', async () => {
    let report: (done: number, total: number) => void = () => undefined;
    let finish: (result: StoreResult<Imported>) => void = () => undefined;
    const run = vi.fn<RunProjectImport<Imported>>((_zip, onProgress) => {
      report = onProgress;
      return new Promise((resolve) => void (finish = resolve));
    });
    const onImported = vi.fn();
    const { result } = renderHook(() => useProjectZipImport(run, onImported));
    let running: Promise<void> = Promise.resolve();
    act(() => void (running = result.current.start(file)));
    expect(result.current.importing).toBe(true);
    expect(result.current.progress).toBe(0);
    act(() => report(1, 4));
    expect(result.current.progress).toBe(0.25);
    await act(async () => {
      finish({ ok: true, value: imported });
      await running;
    });
    expect(result.current.importing).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.message).toBe('Imported Helmet.');
    expect(result.current.error).toBeNull();
    expect(onImported).toHaveBeenCalledWith(imported);
  });

  it('materialgen-prep R62 a refused zip shows its typed reason and reports nothing as imported', async () => {
    const run = vi.fn<RunProjectImport<Imported>>().mockResolvedValue(storeFailure('corrupt', 'This file is not a project export.'));
    const onImported = vi.fn();
    const { result } = renderHook(() => useProjectZipImport(run, onImported));
    await act(() => result.current.start(file));
    expect(result.current.error).toBe('This file is not a project export.');
    expect(result.current.message).toBeNull();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('materialgen-prep R62 a run that throws is shown as a failure rather than escaping', async () => {
    const run = vi.fn<RunProjectImport<Imported>>(async () => Promise.reject(new Error('boom')));
    const { result } = renderHook(() => useProjectZipImport(run));
    await act(() => result.current.start(file));
    expect(result.current.error).toBe('The project could not be imported.');
    expect(result.current.importing).toBe(false);
  });

  it('materialgen-prep R62 only one import runs at a time, and the next start clears the old message and error', async () => {
    const run = vi
      .fn<RunProjectImport<Imported>>()
      .mockResolvedValueOnce(storeFailure('corrupt', 'Bad zip.'))
      .mockImplementationOnce(() => new Promise<StoreResult<Imported>>(() => undefined));
    const { result } = renderHook(() => useProjectZipImport(run));
    await act(() => result.current.start(file));
    expect(result.current.error).toBe('Bad zip.');
    act(() => void result.current.start(file));
    expect(result.current.error).toBeNull();
    await act(() => result.current.start(file));
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('materialgen-prep R62 a new run function on re-render keeps start stable', () => {
    const { result, rerender } = renderHook(() => useProjectZipImport<Imported>(() => Promise.resolve(storeFailure('corrupt', 'x'))));
    const first = result.current.start;
    rerender();
    expect(result.current.start).toBe(first);
  });
});
