import { discoverModels, type ProviderModelRecord } from '../../generation';
import { PROVIDERS, type KeyVault, type Provider } from '../../keys';
import { buildModelCatalog } from './buildModelCatalog';

export type CatalogWatchVault = Pick<KeyVault, 'status' | 'hasKey' | 'getKey' | 'on'>;
export type WatchedCatalog = ReturnType<typeof buildModelCatalog>;

interface CatalogWatchInputs {
  keys: CatalogWatchVault;
  discover?: typeof discoverModels;
  /** Called at once and after every vault change or finished discovery with the providers that have a key and the catalog built from them. */
  onChange(keyed: readonly Provider[], catalog: WatchedCatalog): void;
}

/**
 * Generate R16, R20: keeps a model catalog in step with the key vault. Providers without a key are dropped; once the vault is unlocked each keyed provider is asked
 * which models its key can use, and a failed request keeps the earlier list. Returns the function that stops listening and cancels what is in flight.
 */
export function watchModelCatalog({ keys, discover = discoverModels, onChange }: CatalogWatchInputs): () => void {
  const discovered: Partial<Record<Provider, ProviderModelRecord[]>> = {};
  let inFlight: AbortController | null = null;

  const publish = (): Provider[] => {
    const keyed = PROVIDERS.filter((provider) => keys.hasKey(provider));
    for (const provider of PROVIDERS) if (!keyed.includes(provider)) delete discovered[provider];
    onChange(keyed, buildModelCatalog(keyed, discovered));
    return keyed;
  };

  const discoverAll = (keyed: Provider[]): void => {
    const run = new AbortController();
    inFlight = run;
    for (const provider of keyed) {
      const key = keys.getKey(provider);
      if (key === null) continue;
      void discover(provider, key, run.signal)
        .then((result) => {
          if (run.signal.aborted || !result.ok) return; // an answer for an older vault state is dropped
          discovered[provider] = result.value;
          publish();
        })
        .catch(() => undefined);
    }
  };

  const sync = (): void => {
    inFlight?.abort();
    inFlight = null;
    const keyed = publish();
    if (keys.status() === 'unlocked') discoverAll(keyed);
  };

  sync();
  const stopListening = keys.on('status-changed', sync);
  return () => {
    stopListening();
    inFlight?.abort();
  };
}
