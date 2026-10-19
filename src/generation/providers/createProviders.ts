import { createGeminiImageGenerator } from './gemini/geminiImageGenerator';
import { createGeminiPromptEnhancer } from './gemini/geminiPromptEnhancer';
import type { ImageGenerator } from './ImageGenerator';
import { createOpenAiImageGenerator } from './openai/openaiImageGenerator';
import { createOpenAiPromptEnhancer } from './openai/openaiPromptEnhancer';
import type { PromptEnhancer } from './PromptEnhancer';
import type { Provider } from './providerTypes';

// R7: the image generator of a provider.
export function createImageGenerator(provider: Provider, fetchImpl: typeof fetch = fetch): ImageGenerator {
  return provider === 'gemini' ? createGeminiImageGenerator(fetchImpl) : createOpenAiImageGenerator(fetchImpl);
}

// R8: the prompt enhancer of a provider.
export function createPromptEnhancer(provider: Provider, fetchImpl: typeof fetch = fetch): PromptEnhancer {
  return provider === 'gemini' ? createGeminiPromptEnhancer(fetchImpl) : createOpenAiPromptEnhancer(fetchImpl);
}
