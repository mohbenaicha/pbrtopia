import type { Provider } from '../../keys';
import type { SelectOption } from '../../ui-kit';

export interface ModelChoice {
  provider: Provider;
  value: string; // the option's value
  displayName: string;
  verified: boolean;
  deprecated?: boolean;
}

const GROUP_ORDER: Provider[] = ['gemini', 'openai', 'openrouter'];
const GROUP_HEADING: Record<Provider, string> = { gemini: 'Google', openai: 'OpenAI', openrouter: 'OpenRouter' };

const byLabel = (a: SelectOption, b: SelectOption): number => a.label.localeCompare(b.label);

/**
 * Generate R4 (2026-11-13): the one order of every model dropdown. Verified models come first under a heading per provider, each group sorted by name;
 * the unverified models of all providers follow, sorted by label, under no heading and below a separator. A deprecated model keeps its place but is disabled.
 */
export function arrangeModelOptions(models: readonly ModelChoice[], formatLabel: (provider: Provider, displayName: string) => string): SelectOption[] {
  const labelOf = (model: ModelChoice, mark: string): string => `${formatLabel(model.provider, model.displayName)}${mark}`;
  const verified: SelectOption[] = [];
  for (const provider of GROUP_ORDER) {
    const group = models
      .filter((model) => model.provider === provider && model.verified)
      .map((model): SelectOption => ({ value: model.value, label: labelOf(model, model.deprecated === true ? ' (deprecated)' : ''), group: GROUP_HEADING[provider], ...(model.deprecated === true ? { disabled: true } : {}) }))
      .sort(byLabel);
    verified.push(...group);
  }
  const unverified = models
    .filter((model) => !model.verified)
    .map((model): SelectOption => ({ value: model.value, label: labelOf(model, ' (unverified)') }))
    .sort(byLabel);
  const [first, ...rest] = unverified;
  if (first === undefined) return verified;
  return [...verified, verified.length > 0 ? { ...first, separatorBefore: true } : first, ...rest];
}
