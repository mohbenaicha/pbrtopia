import { useEffect, useState } from 'react';
import { PROVIDERS, type Provider } from '@shared/keys';
import { useAppBackends, watchModelCatalog } from '@shared/shell';
import type { ModelCatalog } from '../plan/presetPlans';

export interface ModelCatalogFeed {
  catalog: ModelCatalog;
  hasKey: Record<Provider, boolean>;
  ready: boolean; // the stored vault has been read, so `hasKey` is true to the stored keys
}

const EMPTY: ModelCatalogFeed = { catalog: { gemini: [], openai: [], openrouter: [] }, hasKey: { gemini: false, openai: false, openrouter: false }, ready: false };

/** Generation R65, R67: the models and key flags of the providers that have a key, kept in step with the vault (Settings > Keys). */
export function useModelCatalogFeed(): ModelCatalogFeed {
  const { keys, keysLoaded, discoverModels } = useAppBackends();
  const [feed, setFeed] = useState<ModelCatalogFeed>(EMPTY);

  useEffect(() => {
    if (!keysLoaded) return;
    return watchModelCatalog({
      keys,
      discover: discoverModels,
      // The material generator's saved plans do not hold OpenRouter models yet, so it is offered none (generate R43).
      onChange: (keyed, catalog) => setFeed({ catalog: { ...catalog, openrouter: [] }, hasKey: Object.fromEntries(PROVIDERS.map((provider) => [provider, keyed.includes(provider)])) as Record<Provider, boolean>, ready: true }),
    });
  }, [keys, keysLoaded, discoverModels]);

  return feed;
}
