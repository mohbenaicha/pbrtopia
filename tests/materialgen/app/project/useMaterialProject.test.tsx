// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMaterialProject } from '@mat/app/project/useMaterialProject';
import { createTestMaterialStore, png, type TestMaterialStore } from '../../storage/materialStoreFixtures';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let test: TestMaterialStore;
let projectId: string;

beforeEach(async () => {
  test = await createTestMaterialStore();
  const made = await test.store.createProject({ name: 'Bricks', size: 1024 });
  if (!made.ok) throw new Error('setup');
  projectId = made.value.id;
});

const open = (canWrite = true) => renderHook(() => useMaterialProject({ store: test.store, projectId, canWrite }));
const stored = async () => {
  const result = await test.store.loadProject(projectId);
  if (!result.ok) throw new Error('load');
  return result.value;
};

describe('materialgen/app useMaterialProject', () => {
  it('R12b it reads the record, loading until it arrives', async () => {
    const { result } = open();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.record?.name).toBe('Bricks'));
    expect(result.current.loading).toBe(false);
  });

  it('R29 commit stores the record at once and shows it; a prompt typed earlier is stored with it', async () => {
    const { result } = open();
    await waitFor(() => expect(result.current.record).not.toBeNull());
    act(() => result.current.edit((record) => ({ ...record, prompt: 'mossy' })));
    let outcome: Awaited<ReturnType<typeof result.current.commit>> | undefined;
    await act(async () => {
      outcome = await result.current.commit((record) => ({ ...record, size: 512 }));
    });
    expect(outcome?.ok).toBe(true);
    expect(result.current.record).toMatchObject({ size: 512, prompt: 'mossy' });
    expect(await stored()).toMatchObject({ size: 512, prompt: 'mossy' });
  });

  it('R29 a commit that cannot be stored changes nothing on screen and reports the failure code', async () => {
    const onSaveFailure = vi.fn();
    const failing = { ...test.store, saveProject: vi.fn(async () => ({ ok: false as const, error: { code: 'quota-exceeded' as const, message: 'Full.' } })) };
    const { result } = renderHook(() => useMaterialProject({ store: failing, projectId, canWrite: true, onSaveFailure }));
    await waitFor(() => expect(result.current.record).not.toBeNull());
    let outcome: Awaited<ReturnType<typeof result.current.commit>> | undefined;
    await act(async () => {
      outcome = await result.current.commit((record) => ({ ...record, size: 512 }));
    });
    expect(outcome?.ok).toBe(false);
    expect(result.current.record?.size).toBe(1024);
    expect(onSaveFailure).toHaveBeenCalledWith('quota-exceeded');
  });

  it('R29 a read-only project refuses a commit', async () => {
    const { result } = open(false);
    await waitFor(() => expect(result.current.record).not.toBeNull());
    let outcome: Awaited<ReturnType<typeof result.current.commit>> | undefined;
    await act(async () => {
      outcome = await result.current.commit((record) => ({ ...record, size: 512 }));
    });
    expect(outcome?.ok).toBe(false);
    expect((await stored()).size).toBe(1024);
  });

  it('R12b a project that cannot be opened reports why and has no record', async () => {
    const { result } = renderHook(() => useMaterialProject({ store: test.store, projectId: 'missing', canWrite: true }));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.record).toBeNull();
  });

  it('R33 a change is shown at once and written no later than 400 ms after, not before', async () => {
    const { result } = open();
    await waitFor(() => expect(result.current.record).not.toBeNull());
    vi.useFakeTimers({ shouldAdvanceTime: false, toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    act(() => result.current.edit((record) => ({ ...record, prompt: 'mossy' })));
    expect(result.current.record?.prompt).toBe('mossy');
    await act(async () => vi.advanceTimersByTimeAsync(399));
    expect((await stored()).prompt).toBe('');
    await act(async () => vi.advanceTimersByTimeAsync(2));
    await vi.waitFor(async () => expect((await stored()).prompt).toBe('mossy'));
  });

  it('R33 changes inside the window join one write and the last value wins', async () => {
    const { result } = open();
    await waitFor(() => expect(result.current.record).not.toBeNull());
    const save = vi.spyOn(test.store, 'saveProject');
    act(() => {
      result.current.edit((record) => ({ ...record, prompt: 'a' }));
      result.current.edit((record) => ({ ...record, prompt: 'ab' }));
      result.current.edit((record) => ({ ...record, colorMode: 'diffuse' }));
    });
    await act(() => result.current.flush());
    expect(save).toHaveBeenCalledTimes(1);
    expect(await stored()).toMatchObject({ prompt: 'ab', colorMode: 'diffuse' });
  });

  it('R13 R33 in read-only mode an edit changes nothing and writes nothing', async () => {
    const { result } = open(false);
    await waitFor(() => expect(result.current.record).not.toBeNull());
    act(() => result.current.edit((record) => ({ ...record, prompt: 'nope' })));
    await act(() => result.current.flush());
    expect(result.current.record?.prompt).toBe('');
    expect((await stored()).prompt).toBe('');
  });

  it('R12 closing the project writes what was waiting', async () => {
    const { result, unmount } = open();
    await waitFor(() => expect(result.current.record).not.toBeNull());
    act(() => result.current.edit((record) => ({ ...record, prompt: 'kept' })));
    unmount();
    await vi.waitFor(async () => expect((await stored()).prompt).toBe('kept'));
  });

  it('R33 the page turning hidden writes what is waiting', async () => {
    const { result } = open();
    await waitFor(() => expect(result.current.record).not.toBeNull());
    act(() => result.current.edit((record) => ({ ...record, prompt: 'hidden' })));
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    hidden.mockRestore();
    await vi.waitFor(async () => expect((await stored()).prompt).toBe('hidden'));
  });

  it('R33 a failed save is reported with its reason code and the next change retries', async () => {
    const onSaveFailure = vi.fn();
    const { result } = renderHook(() => useMaterialProject({ store: test.store, projectId, canWrite: true, onSaveFailure }));
    await waitFor(() => expect(result.current.record).not.toBeNull());
    vi.spyOn(test.store, 'saveProject').mockResolvedValueOnce({ ok: false, error: { code: 'quota-exceeded', message: 'Full.' } });
    act(() => result.current.edit((record) => ({ ...record, prompt: 'one' })));
    await act(() => result.current.flush());
    expect(onSaveFailure).toHaveBeenCalledWith('quota-exceeded');
    act(() => result.current.edit((record) => ({ ...record, prompt: 'two' })));
    await act(() => result.current.flush());
    expect((await stored()).prompt).toBe('two');
  });

  it('R34 opening writable deletes a file no field references; read-only leaves it', async () => {
    await test.store.writeBlob(projectId, 'stray.png', png(1));
    const sweep = vi.spyOn(test.store, 'sweepOrphanBlobs');
    const readOnly = open(false);
    await waitFor(() => expect(readOnly.result.current.record).not.toBeNull());
    expect(sweep).not.toHaveBeenCalled();
    expect(await test.store.readBlob(projectId, 'stray.png')).not.toBeNull();
    readOnly.unmount();
    open(true);
    await vi.waitFor(async () => expect(await test.store.readBlob(projectId, 'stray.png')).toBeNull());
  });

  it('R12 renaming writes the waiting save first, then the new name, and the record shows it', async () => {
    const { result } = open();
    await waitFor(() => expect(result.current.record).not.toBeNull());
    act(() => result.current.edit((record) => ({ ...record, prompt: 'p' })));
    let outcome: Awaited<ReturnType<typeof result.current.rename>> | undefined;
    await act(async () => void (outcome = await result.current.rename('  Stone  ')));
    expect(outcome?.ok).toBe(true);
    expect(result.current.record?.name).toBe('Stone');
    expect(await stored()).toMatchObject({ name: 'Stone', prompt: 'p' });
  });

  it('R32 a read-only tab cannot rename: it is refused and nothing is stored', async () => {
    const { result } = open(false);
    await waitFor(() => expect(result.current.record).not.toBeNull());
    let outcome: Awaited<ReturnType<typeof result.current.rename>> | undefined;
    await act(async () => void (outcome = await result.current.rename('Stone')));
    expect(outcome).toMatchObject({ ok: false });
    expect(result.current.record?.name).toBe('Bricks');
    expect((await stored()).name).toBe('Bricks');
  });

  it('R12 an invalid name is refused with a message and changes nothing', async () => {
    const { result } = open();
    await waitFor(() => expect(result.current.record).not.toBeNull());
    let outcome: Awaited<ReturnType<typeof result.current.rename>> | undefined;
    await act(async () => void (outcome = await result.current.rename('   ')));
    expect(outcome).toMatchObject({ ok: false });
    expect(result.current.record?.name).toBe('Bricks');
  });
});
