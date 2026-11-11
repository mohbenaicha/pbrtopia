import type { ProviderModelRecord } from '../../generation';
import { PROVIDERS, type Provider } from '../../keys';
import type { CatalogCacheRecord } from '../../projects/records/appSettingsRecord';

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

function readCachedModel(provider: Provider, entry: Record<string, unknown>): ProviderModelRecord | null {
  const { id, displayName, role, verified, resolutions, qualityLevels } = entry;
  if (entry['provider'] !== provider || !isText(id) || (role !== 'image' && role !== 'vision-text') || typeof verified !== 'boolean') return null;
  return {
    ...entry,
    provider,
    id,
    displayName: isText(displayName) ? displayName : id,
    role,
    verified,
    resolutions: Array.isArray(resolutions) ? (resolutions as ProviderModelRecord['resolutions']) : [],
    qualityLevels: Array.isArray(qualityLevels) ? (qualityLevels as string[]) : [],
  };
}

/** Settings R6: the model lists of the last refresh; entries that are not well-formed are dropped, and a provider left with none is absent. */
export function readCachedModelLists(cache: CatalogCacheRecord | null): Partial<Record<Provider, ProviderModelRecord[]>> {
  const lists: Partial<Record<Provider, ProviderModelRecord[]>> = {};
  if (cache === null) return lists;
  for (const provider of PROVIDERS) {
    const models = cache[provider].map((entry) => readCachedModel(provider, entry)).filter((model): model is ProviderModelRecord => model !== null);
    if (models.length > 0) lists[provider] = models;
  }
  return lists;
}
