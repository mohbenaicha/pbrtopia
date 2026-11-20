import type { Provider } from '../../keys';
import type { ProviderModelRecord } from './modelTypes';

export interface ModelProblemInput {
  catalog: Record<Provider, ProviderModelRecord[]>;
  hasKey: Record<Provider, boolean>;
}

const PROVIDER_NAME: Record<Provider, string> = { gemini: 'Gemini', openai: 'OpenAI', openrouter: 'OpenRouter' };

// Generate R19: why an image model cannot be used right now (not listed, not verified, no key), or null. Pure, so the projection panel and the material app share it.
export function describeImageModelProblem(input: ModelProblemInput, provider: Provider, modelId: string): string | null {
  const image = input.catalog[provider].find((model) => model.id === modelId);
  if (image === undefined) return 'The chosen image model is no longer available. Choose another.';
  if (!image.verified) return 'This image model is not verified yet, so its sizes and quality levels are unknown. Choose another.';
  if (!input.hasKey[provider]) return `Add a ${PROVIDER_NAME[provider]} key in Settings.`;
  return null;
}
