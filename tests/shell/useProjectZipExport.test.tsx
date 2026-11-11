// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { storeFailure, type StoreResult } from '../../src/projects';
import { useProjectZipExport } from '../../src/shell';

afterEach(cleanup);

const note = (n: number): string | null => (n === 0 ? null : `${n} left out`);

describe('useProjectZipExport', () => {
  it('materialgen-prep R64 it exports once at a time and a clean export leaves no message', async () => {
    let finish: (r: StoreResult<number>) => void = () => undefined;
    const save = vi.fn(() => new Promise<StoreResult<number>>((resolve) => void (finish = resolve)));
    const { result } = renderHook(() => useProjectZipExport(save, note));
    let first: Promise<void> = Promise.resolve();
    act(() => void (first = result.current.start()));
    expect(result.current.exporting).toBe(true);
    act(() => void result.current.start());
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish({ ok: true, value: 0 });
      await first;
    });
    expect(result.current.exporting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('materialgen-prep R64 a note about what was left out and a typed failure both become the message', async () => {
    const save = vi.fn().mockResolvedValueOnce({ ok: true, value: 2 }).mockResolvedValueOnce(storeFailure('aborted', 'Could not write.'));
    const { result } = renderHook(() => useProjectZipExport<number>(save, note));
    await act(() => result.current.start());
    expect(result.current.error).toBe('2 left out');
    await act(() => result.current.start());
    expect(result.current.error).toBe('Could not write.');
  });

  it('materialgen-prep R64 a throw is shown as a failure and no project means nothing happens', async () => {
    const { result } = renderHook(() => useProjectZipExport<number>(() => Promise.reject(new Error('boom')), note));
    await act(() => result.current.start());
    expect(result.current.error).toBe('The project could not be exported.');
    const none = renderHook(() => useProjectZipExport<number>(null, note));
    await act(() => none.result.current.start());
    expect(none.result.current.exporting).toBe(false);
  });
});
