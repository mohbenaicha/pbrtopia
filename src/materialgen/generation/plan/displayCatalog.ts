import { KNOWN_MODELS } from '@shared/generation';
import { PROVIDERS } from '@shared/keys';
import type { ModelCatalog } from './presetPlans';

/**
 * Generation R62, R63: the catalog the hint and the settings fields read. A provider with no key has no models in the real catalog; here it lists the shipped table's, so a plan
 * still shows its images, sizes and prices before any key exists. The problems that gate Generate (R65) are never read from this one.
 */
export function withKnownModels(catalog: ModelCatalog): ModelCatalog {
  const filled = { ...catalog };
  for (const provider of PROVIDERS) {
    if (filled[provider].length === 0) filled[provider] = KNOWN_MODELS.filter((model) => model.provider === provider);
  }
  return filled;
}
