import { pickEnhancerModel, type EnhancerChoice, type ModelCatalog } from '../../generation';
import { PROVIDERS, type Provider } from '../../keys';
import type { SelectOption } from '../../ui-kit';
import { PROVIDER_NAMES } from './providerNames';

/** The option value of an enhancer choice: '<provider>:<modelId>'. */
const enhancerValue =(choice: EnhancerChoice): string => `${choice.provider}:${choice.modelId}`;

export function parseEnhancerValue(value: string): EnhancerChoice | null {
  const separator = value.indexOf(':');
  if (separator < 0) return null;
  return { provider: value.slice(0, separator) as Provider, modelId: value.slice(separator + 1) };
}

/**
 * Settings R5: the vision-text models of the keyed providers; a stored choice outside the list is appended and kept selected. With no stored choice the one shown is the default
 * the app uses: GPT-6 Luna with an OpenAI key, else Gemini 3.8 Flash with a Gemini key (there is no "Automatic" row).
 */
export function buildEnhancerOptions(input: { keyed: readonly Provider[]; catalog: ModelCatalog; stored: EnhancerChoice | null }): { options: SelectOption[]; value: string } {
  const options: SelectOption[] = [];
  for (const provider of PROVIDERS) {
    if (!input.keyed.includes(provider)) continue;
    for (const model of input.catalog[provider]) {
      if (model.role !== 'vision-text') continue;
      options.push({ value: `${provider}:${model.id}`, label: `${PROVIDER_NAMES[provider]} · ${model.displayName}${model.verified ? '' : ' (unverified)'}` });
    }
  }
  if (input.stored === null) {
    const hasKey: Record<Provider, boolean> = { gemini: input.keyed.includes('gemini'), openai: input.keyed.includes('openai') };
    const fallback = pickEnhancerModel({ enhancer: null, provider: null, catalog: input.catalog, hasKey });
    const shown = fallback === null ? null : enhancerValue(fallback);
    return { options, value: shown !== null && options.some((option) => option.value === shown) ? shown : (options[0]?.value ?? '') };
  }
  const value = enhancerValue(input.stored);
  if (!options.some((option) => option.value === value)) options.push({ value, label: `${input.stored.modelId} (not in the list)` });
  return { options, value };
}
