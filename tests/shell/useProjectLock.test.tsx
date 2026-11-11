// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useProjectLock } from '../../src/shell/useProjectLock';
import type { ProjectLock } from '../../src/projects/lock/acquireProjectLock';

afterEach(cleanup);

const lockOf = (held: boolean): ProjectLock & { release: Mock<() => void> } => ({ held, release: vi.fn<() => void>() });

describe('useProjectLock', () => {
  it('materialgen-prep R65 and projects R4 it is checking until the lock answers, then held or read-only', async () => {
    const free = lockOf(true);
    const first = renderHook(() => useProjectLock('p1', () => Promise.resolve(free)));
    expect(first.result.current).toBe('checking');
    await waitFor(() => expect(first.result.current).toBe('held'));
    const taken = renderHook(() => useProjectLock('p1', () => Promise.resolve(lockOf(false))));
    await waitFor(() => expect(taken.result.current).toBe('read-only'));
  });

  it('R4 the lock is released when the view closes', async () => {
    const lock = lockOf(true);
    const { result, unmount } = renderHook(() => useProjectLock('p1', () => Promise.resolve(lock)));
    await waitFor(() => expect(result.current).toBe('held'));
    expect(lock.release).not.toHaveBeenCalled();
    unmount();
    expect(lock.release).toHaveBeenCalledTimes(1);
  });

  it('R4 a view closed before the lock answered releases it as soon as it arrives', async () => {
    const lock = lockOf(true);
    let answer: (lock: ProjectLock) => void = () => undefined;
    const { unmount } = renderHook(() => useProjectLock('p1', () => new Promise<ProjectLock>((resolve) => (answer = resolve))));
    unmount();
    await act(async () => answer(lock));
    expect(lock.release).toHaveBeenCalledTimes(1);
  });

  it('R4 opening another project releases the first lock and asks for the new one', async () => {
    const locks = new Map([['p1', lockOf(true)], ['p2', lockOf(false)]]);
    const acquire = vi.fn((id: string) => Promise.resolve(locks.get(id)!));
    const { result, rerender } = renderHook(({ id }) => useProjectLock(id, acquire), { initialProps: { id: 'p1' } });
    await waitFor(() => expect(result.current).toBe('held'));
    rerender({ id: 'p2' });
    expect(locks.get('p1')!.release).toHaveBeenCalledTimes(1);
    expect(result.current).toBe('checking');
    await waitFor(() => expect(result.current).toBe('read-only'));
    expect(acquire).toHaveBeenCalledWith('p2');
  });
});
