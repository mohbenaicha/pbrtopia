// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { KeyVault } from '../../../src/keys/KeyVault';
import { useVaultVersion } from '../../../src/keys/ui/useVaultVersion';

function fakeVault() {
  const listeners = new Set<() => void>();
  const unsubscribe = vi.fn();
  const vault = {
    on: (_event: 'status-changed', listener: () => void) => {
      listeners.add(listener);
      return () => {
        unsubscribe();
        listeners.delete(listener);
      };
    },
  } as unknown as KeyVault;
  return { vault, listeners, unsubscribe, emit: () => listeners.forEach((listener) => listener()) };
}

describe('useVaultVersion (R12)', () => {
  it('R12 it starts at 0 and the number goes up each time the vault reports a status change', () => {
    const { vault, emit } = fakeVault();
    const { result } = renderHook(() => useVaultVersion(vault));
    expect(result.current).toBe(0);
    act(() => emit());
    expect(result.current).toBe(1);
    act(() => emit());
    expect(result.current).toBe(2);
  });

  it('R12 a component using it re-renders on each change', () => {
    const { vault, emit } = fakeVault();
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useVaultVersion(vault);
    });
    const before = renders;
    act(() => emit());
    expect(renders).toBeGreaterThan(before);
  });

  it('R12 it listens once, and stops listening when the component goes away', () => {
    const { vault, listeners, unsubscribe } = fakeVault();
    const { rerender, unmount } = renderHook(() => useVaultVersion(vault));
    rerender();
    expect(listeners.size).toBe(1);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });
});
