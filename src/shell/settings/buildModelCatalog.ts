import { KNOWN_MODELS, type ModelCatalog, type ProviderModelRecord } from '../../generation';
import { PROVIDERS, type Provider } from '../../keys';

/** Generate R20: the image and enhancer models offered for the providers that have a key: the discovered list when there is one, else the shipped table's. */
export function buildModelCatalog(keyed: readonly Provider[], discovered: Partial<Record<Provider, ProviderModelRecord[]>> = {}): ModelCatalog {
  const catalog: ModelCatalog = { gemini: [], openai: [], openrouter: [] };
  for (const provider of PROVIDERS) {
    if (!keyed.includes(provider)) continue;
    catalog[provider] = discovered[provider] ?? KNOWN_MODELS.filter((model) => model.provider === provider);
  }
  return catalog;
}
