import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { PROVIDERS, type Provider, type ProviderKeySource } from '../../keys';
import type { SharedProjectStore } from '../../projects/SharedProjectStore';
import type { AppSettingsRecord, CatalogCacheRecord } from '../../projects/records/appSettingsRecord';
import type { SelectOption } from '../../ui-kit';
import { buildModelCatalog } from './buildModelCatalog';
import { buildEnhancerOptions, parseEnhancerValue } from './buildEnhancerOptions';
import { readCachedModelLists } from './cachedModelLists';

interface ModelSettingsState {
  loaded: boolean; // the stored vault and the saved settings have both been read
  keyed: Provider[];
  options: SelectOption[];
  value: string;
  saveError: string | null;
  updatedAt: string | null; // when the cached lists were fetched; null while the built-in list is shown
  choose(value: string): Promise<void>;
}

type Saved = Pick<AppSettingsRecord, 'enhancer' | 'catalog'>;

/** Settings R5, R6: the enhancer dropdown's options and value from the saved choice, the model lists and the keys now stored. */
export function useModelSettings(
  store: Pick<SharedProjectStore, 'loadAppSettings' | 'saveAppSettings'>,
  vault: Pick<ProviderKeySource, 'hasKey' | 'on'>,
  keysLoaded: boolean,
  refreshedCatalog: CatalogCacheRecord | null,
): ModelSettingsState {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, keysChanged] = useReducer((count: number) => count + 1, 0);
  const mounted = useRef(true);
  const stored = useRef<AppSettingsRecord['enhancer']>(null); // the last enhancer choice the store accepted (or held on load)
  const latestChoice = useRef(0); // numbers the choices, so only the latest one's failure is shown
  const refreshed = useRef(refreshedCatalog); // a refresh's lists win over the cache this section loaded, whichever arrives last
  refreshed.current = refreshedCatalog;

  useEffect(() => {
    mounted.current = true;
    void store.loadAppSettings().then((settings) => {
      if (!mounted.current) return;
      stored.current = settings.enhancer;
      setSaved({ enhancer: settings.enhancer, catalog: refreshed.current ?? settings.catalog });
    });
    const stopListening = vault.on('status-changed', keysChanged);
    return () => {
      mounted.current = false;
      stopListening();
    };
  }, [store, vault]);

  const choose = useCallback(
    async (value: string): Promise<void> => {
      const chosen = parseEnhancerValue(value);
      latestChoice.current += 1;
      const mine = latestChoice.current;
      setSaveError(null);
      setSaved((current) => (current === null ? current : { ...current, enhancer: chosen }));
      const result = await store.saveAppSettings({ enhancer: chosen });
      if (result.ok) {
        stored.current = chosen;
        return;
      }
      if (!mounted.current || mine !== latestChoice.current) return;
      setSaved((current) => (current === null ? current : { ...current, enhancer: stored.current }));
      setSaveError(result.error.message);
    },
    [store],
  );

  useEffect(() => {
    if (refreshedCatalog !== null) setSaved((current) => (current === null ? current : { ...current, catalog: refreshedCatalog }));
  }, [refreshedCatalog]);

  const keyed = keysLoaded ? PROVIDERS.filter((provider) => vault.hasKey(provider)) : [];
  const catalog = buildModelCatalog(keyed, readCachedModelLists(saved?.catalog ?? null));
  const { options, value } = buildEnhancerOptions({ keyed, catalog, stored: saved?.enhancer ?? null });
  return { loaded: keysLoaded && saved !== null, keyed, options, value, saveError, updatedAt: saved?.catalog?.fetchedAt ?? null, choose };
}
