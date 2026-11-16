import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { KeyVault } from '../KeyVault';

// R12: a number that changes each time the vault says its status changed, so a component that reads the vault re-renders.
export function useVaultVersion(vault: Pick<KeyVault, 'on'>): number {
  const version = useRef(0);
  const subscribe = useCallback(
    (notify: () => void) =>
      vault.on('status-changed', () => {
        version.current += 1;
        notify();
      }),
    [vault],
  );
  return useSyncExternalStore(subscribe, () => version.current);
}
