import type { PromptEnhancer } from '@shared/generation';
import type { Provider, ProviderKeySource } from '@shared/keys';
import type { DescribeTarget } from '@mat/generation';
import type { StepOutcome } from '@shared/materialMasks';

interface DescribeBackends {
  target: DescribeTarget | null;
  keys: Pick<ProviderKeySource, 'resolveKey'>;
  createPromptEnhancer(provider: Provider): PromptEnhancer;
}

const PROVIDER_NAME: Record<Provider, string> = { gemini: 'Gemini', openai: 'OpenAI', openrouter: 'OpenRouter' };

/** Masks R1, R64, R67: one call of the describe model with the text and the albedo reference; the key is read per call and never kept. */
export function askDescribeModel({ target, keys, createPromptEnhancer }: DescribeBackends): (text: string, image: Blob, signal: AbortSignal) => Promise<StepOutcome<string>> {
  return async (text, image, signal) => {
    if (target === null) return { ok: false, message: 'Choose a vision-text model in Settings > Models.' };
    const resolved = await keys.resolveKey(target.provider, signal);
    if (!resolved.ok) return { ok: false, message: resolved.error.code === 'vault-missing' ? `Add your ${PROVIDER_NAME[target.provider]} key in Settings > Keys` : resolved.error.message };
    const apiKey = resolved.value;
    const answer = await createPromptEnhancer(target.provider).enhance({ model: target.modelId, prompt: text, image, level: target.level }, { apiKey, signal });
    return answer.ok ? { ok: true, value: answer.value } : { ok: false, message: answer.error.message };
  };
}
