import { createGeminiImageGenerator } from './gemini/geminiImageGenerator';
import { createGeminiPromptEnhancer } from './gemini/geminiPromptEnhancer';
import type { ImageGenerator } from './ImageGenerator';
import { createOpenAiImageGenerator } from './openai/openaiImageGenerator';
import { createOpenAiPromptEnhancer } from './openai/openaiPromptEnhancer';
import { createOpenRouterImageGenerator } from './openrouter/openrouterImageGenerator';
import { makeProviderError } from './classifyProviderError';
import type { PromptEnhancer } from './PromptEnhancer';
import type { Provider } from './providerTypes';

const IMAGE_GENERATORS: Record<Provider, (fetchImpl: typeof fetch) => ImageGenerator> = {
  gemini: createGeminiImageGenerator,
  openai: createOpenAiImageGenerator,
  openrouter: (fetchImpl) => createOpenRouterImageGenerator(fetchImpl),
};

// A provider with no enhancer model (generate R43): never reached, because no model of it has the role vision-text; it refuses if it is.
const refuseToEnhance = (): PromptEnhancer => ({ enhance: async () => ({ ok: false, error: makeProviderError('bad-request') }) });

const PROMPT_ENHANCERS: Record<Provider, (fetchImpl: typeof fetch) => PromptEnhancer> = {
  gemini: createGeminiPromptEnhancer,
  openai: createOpenAiPromptEnhancer,
  openrouter: refuseToEnhance,
};

// R7: the image generator of a provider.
export const createImageGenerator = (provider: Provider, fetchImpl: typeof fetch = fetch): ImageGenerator => IMAGE_GENERATORS[provider](fetchImpl);

// R8: the prompt enhancer of a provider.
export const createPromptEnhancer = (provider: Provider, fetchImpl: typeof fetch = fetch): PromptEnhancer => PROMPT_ENHANCERS[provider](fetchImpl);
