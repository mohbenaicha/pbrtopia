import { arrangeModelOptions, pickEnhancerModel, type EnhancerChoice, type ModelCatalog } from '../../generation';
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
  const options: SelectOption[] = arrangeModelOptions(
    PROVIDERS.filter((provider) => input.keyed.includes(provider)).flatMap((provider) =>
      input.catalog[provider].filter((model) => model.role === 'vision-text').map((model) => ({ provider, value: `${provider}:${model.id}`, displayName: model.displayName, verified: model.verified, ...(model.deprecated === true ? { deprecated: true } : {}) })),
    ),
    (provider, displayName) => `${PROVIDER_NAMES[provider]} · ${displayName}`,
  );
  if (input.stored === null) {
    const hasKey: Record<Provider, boolean> = Object.fromEntries(PROVIDERS.map((provider) => [provider, input.keyed.includes(provider)])) as Record<Provider, boolean>;
    const fallback = pickEnhancerModel({ enhancer: null, provider: null, catalog: input.catalog, hasKey });
    const shown = fallback === null ? null : enhancerValue(fallback);
    return { options, value: shown !== null && options.some((option) => option.value === shown) ? shown : (options.find((option) => option.disabled !== true)?.value ?? '') };
  }
  const value = enhancerValue(input.stored);
  if (!options.some((option) => option.value === value)) options.push({ value, label: `${input.stored.modelId} (not in the list)` });
  return { options, value };
}
