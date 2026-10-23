// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { keyFailure } from '../../../src/keys/keyError';
import type { KeyVault } from '../../../src/keys/KeyVault';
import { useDeleteSavedKeys } from '../../../src/keys/ui/useDeleteSavedKeys';

function setup(wipe: () => Promise<void>) {
  const calls: string[] = [];
  const vault = { wipe: vi.fn(async () => { calls.push('wipe'); await wipe(); }) } as unknown as KeyVault;
  const prompt = {
    answer: vi.fn((given: unknown) => calls.push(`answer:${String(given)}`)),
    refuseRequests: vi.fn((refuse: boolean) => calls.push(`refuse:${refuse}`)),
  };
  const view = renderHook(() => useDeleteSavedKeys(vault, prompt));
  return { ...view, calls, vault };
}

describe('useDeleteSavedKeys (R6)', () => {
  it('R6 it cancels the open password question and refuses new ones before the wipe, and allows them again after', async () => {
    const { result, calls } = setup(async () => undefined);
    let deleted = false;
    await act(async () => { deleted = await result.current.deleteSavedKeys(); });
    expect(deleted).toBe(true);
    expect(calls).toEqual(['refuse:true', 'answer:null', 'wipe', 'refuse:false']);
    expect(result.current.deleting).toBe(false);
    expect(result.current.failure).toBeNull();
  });

  it('R6 deleting is true while the wipe runs', async () => {
    let finish!: () => void;
    const { result } = setup(() => new Promise<void>((resolve) => { finish = resolve; }));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.deleteSavedKeys(); });
    await waitFor(() => expect(result.current.deleting).toBe(true));
    await act(async () => { finish(); await pending; });
    expect(result.current.deleting).toBe(false);
  });

  it('R6 a failed wipe reports false with the error message, and questions are allowed again', async () => {
    const { result, calls } = setup(async () => { throw new Error('Disk is full.'); });
    let deleted = true;
    await act(async () => { deleted = await result.current.deleteSavedKeys(); });
    expect(deleted).toBe(false);
    expect(result.current.failure).toBe('Disk is full.');
    expect(calls.at(-1)).toBe('refuse:false');
    expect(result.current.deleting).toBe(false);
  });

  it('R6 a failure that is not an Error uses the fixed storage message', async () => {
    const { result } = setup(async () => { throw 'nope'; });
    await act(async () => { await result.current.deleteSavedKeys(); });
    expect(result.current.failure).toBe(keyFailure('storage-failed').error.message);
  });

  it('R6 clearFailure forgets the message, and a new attempt starts without it', async () => {
    let fail = true;
    const { result } = setup(async () => { if (fail) throw new Error('Disk is full.'); });
    await act(async () => { await result.current.deleteSavedKeys(); });
    act(() => result.current.clearFailure());
    expect(result.current.failure).toBeNull();
    await act(async () => { await result.current.deleteSavedKeys(); });
    expect(result.current.failure).toBe('Disk is full.');
    fail = false;
    await act(async () => { await result.current.deleteSavedKeys(); });
    expect(result.current.failure).toBeNull();
  });
});
