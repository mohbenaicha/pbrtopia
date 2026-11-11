import { useCallback, useEffect, useRef, useState } from 'react';
import type { discoverModels } from '../../generation';
import { PROVIDERS, type KeyVault } from '../../keys';
import type { SharedProjectStore } from '../../projects/SharedProjectStore';
import type { CatalogCacheRecord } from '../../projects/records/appSettingsRecord';
import { refreshModelLists } from './refreshModelLists';

export interface ModelListRefreshState {
  refreshing: boolean;
  problems: string[]; // providers that did not answer, with the reason
  error: string | null; // why the refresh could not run or its result could not be stored
  stored: CatalogCacheRecord | null; // what the last refresh wrote; null before any
  start(): Promise<void>;
}

/** Settings R6: Refresh. Held by the Settings view, so a change of section does not stop it; the write happens even if the view was left meanwhile. */
export function useModelListRefresh(
  store: Pick<SharedProjectStore, 'loadAppSettings' | 'saveAppSettings'>,
  vault: Pick<KeyVault, 'hasKey' | 'ensureUnlocked' | 'getKey'>,
  discover: typeof discoverModels,
): ModelListRefreshState {
  const [refreshing, setRefreshing] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stored, setStored] = useState<CatalogCacheRecord | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = useCallback(async (): Promise<void> => {
    const keyed = PROVIDERS.filter((provider) => vault.hasKey(provider));
    if (running.current || keyed.length === 0) return;
    running.current = true;
    setRefreshing(true);
    setProblems([]);
    setError(null);
    try {
      const previous = (await store.loadAppSettings()).catalog;
      const outcome = await refreshModelLists({ keyed, vault, discover, previous, now: () => new Date().toISOString() });
      if (outcome.status === 'unlock-failed') {
        if (mounted.current) setError(outcome.message);
      } else if (outcome.status === 'done') {
        if (mounted.current) setProblems(outcome.problems);
        if (outcome.patch !== null) {
          const saved = await store.saveAppSettings({ catalog: outcome.patch });
          if (!saved.ok) {
            if (mounted.current) setError(saved.error.message);
          } else if (mounted.current) setStored(outcome.patch);
        }
      }
    } finally {
      running.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, [store, vault, discover]);

  return { refreshing, problems, error, stored, start };
}
