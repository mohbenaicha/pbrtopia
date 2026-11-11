// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearReportedFull, useStorageWarning } from '../../src/shell/useStorageWarning';
import type { StorageEstimate } from '../../src/projects/storage/storageHealth';

afterEach(() => {
  cleanup();
  clearReportedFull();
});

const MIB = 1024 * 1024;
const LOW: StorageEstimate = { usedBytes: 950 * MIB, quotaBytes: 1000 * MIB };
const ROOMY: StorageEstimate = { usedBytes: 10 * MIB, quotaBytes: 100_000 * MIB };

function storeReturning(...estimates: (StorageEstimate | null)[]) {
  const estimateStorage = vi.fn(async () => (estimates.length > 1 ? estimates.shift()! : (estimates[0] ?? null)));
  return { store: { estimateStorage }, estimateStorage };
}

describe('useStorageWarning', () => {
  it('R2 it reads the estimate when it mounts and warns when space is low', async () => {
    const { store } = storeReturning(LOW);
    const { result } = renderHook(() => useStorageWarning(store));
    expect(result.current.warn).toBe(false);
    await waitFor(() => expect(result.current.warn).toBe(true));
    expect(result.current.estimate).toEqual(LOW);
  });

  it('R2 plenty of space, or an estimate the browser cannot give, does not warn', async () => {
    const roomy = storeReturning(ROOMY);
    const first = renderHook(() => useStorageWarning(roomy.store));
    await waitFor(() => expect(roomy.estimateStorage).toHaveBeenCalled());
    await waitFor(() => expect(first.result.current.estimate).toEqual(ROOMY));
    expect(first.result.current.warn).toBe(false);
    const unknown = storeReturning(null);
    const second = renderHook(() => useStorageWarning(unknown.store));
    await waitFor(() => expect(unknown.estimateStorage).toHaveBeenCalled());
    expect(second.result.current.warn).toBe(false);
  });

  it('R2 check reads the estimate again and the warning follows it', async () => {
    const { store } = storeReturning(ROOMY, LOW, ROOMY);
    const { result } = renderHook(() => useStorageWarning(store));
    await waitFor(() => expect(result.current.estimate).toEqual(ROOMY));
    await act(() => result.current.check());
    expect(result.current.warn).toBe(true);
    await act(() => result.current.check());
    expect(result.current.warn).toBe(false);
  });

  it('R2 reportFull warns even when space looks fine, and a check that finds room clears it', async () => {
    const { store } = storeReturning(ROOMY);
    const { result } = renderHook(() => useStorageWarning(store));
    await waitFor(() => expect(result.current.estimate).toEqual(ROOMY));
    act(() => result.current.reportFull());
    expect(result.current.full).toBe(true);
    expect(result.current.warn).toBe(true);
    await act(() => result.current.check());
    expect(result.current.full).toBe(false);
    expect(result.current.warn).toBe(false);
  });

  it('R2 a check that cannot read the estimate leaves a reported full store as it was', async () => {
    const { store } = storeReturning(null);
    const { result } = renderHook(() => useStorageWarning(store));
    act(() => result.current.reportFull());
    await act(() => result.current.check());
    expect(result.current.full).toBe(true);
  });

  it('R2 an older estimate that arrives after a newer one does not replace it', async () => {
    const answers: ((value: StorageEstimate) => void)[] = [];
    const store = { estimateStorage: () => new Promise<StorageEstimate>((resolve) => void answers.push(resolve)) };
    const { result } = renderHook(() => useStorageWarning(store));
    await waitFor(() => expect(answers).toHaveLength(1)); // the one asked for on mount
    let again: Promise<void> = Promise.resolve();
    act(() => void (again = result.current.check()));
    await waitFor(() => expect(answers).toHaveLength(2));
    await act(async () => {
      answers[1]!(LOW); // the newer question is answered first
      await again;
    });
    await act(async () => answers[0]!(ROOMY)); // the older answer comes late
    expect(result.current.estimate).toEqual(LOW);
    expect(result.current.warn).toBe(true);
  });

  it('R2 generate R22 a full-disk report that comes after the view was closed is shown by the next view', async () => {
    const { store } = storeReturning(null);
    const first = renderHook(() => useStorageWarning(store));
    const report = first.result.current.reportFull;
    first.unmount();
    report(); // the flush of the last edits ends after the project was left
    const next = renderHook(() => useStorageWarning(store));
    expect(next.result.current.full).toBe(true);
    expect(next.result.current.warn).toBe(true);
  });

  it('R2 an answer that arrives after the view is gone is dropped without an error', async () => {
    let answer: (value: StorageEstimate) => void = () => undefined;
    const store = { estimateStorage: () => new Promise<StorageEstimate>((resolve) => void (answer = resolve)) };
    const { unmount } = renderHook(() => useStorageWarning(store));
    unmount();
    expect(() => answer(LOW)).not.toThrow();
  });
});
