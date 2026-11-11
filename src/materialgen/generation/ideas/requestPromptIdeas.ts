import type { PromptEnhancer } from '@shared/generation';
import type { KeyVault, Provider } from '@shared/keys';
import type { DescribeTarget } from '../ui/bindRunPorts';
import { buildIdeasText } from './buildIdeasText';
import { IDEAS_UNREADABLE, parseIdeas } from './parseIdeas';

export interface IdeasBackends {
  createPromptEnhancer(provider: Provider): PromptEnhancer;
  keys: Pick<KeyVault, 'getKey' | 'ensureUnlocked'>;
}

/** `cancelled`: the unlock question was cancelled or the request was aborted; nothing is shown (R72). */
export type IdeasOutcome = { kind: 'ideas'; ideas: string[] } | { kind: 'error'; message: string } | { kind: 'cancelled' };

const PROVIDER_NAME: Record<Provider, string> = { gemini: 'Gemini', openai: 'OpenAI' };

/** Generation R72: one text-only call to the enhancer model: unlock, the key (read now, never kept), the shared adapter, the parse. */
export async function requestPromptIdeas(target: DescribeTarget, userText: string, backends: IdeasBackends, signal: AbortSignal): Promise<IdeasOutcome> {
  try {
    const unlocked = await backends.keys.ensureUnlocked();
    if (!unlocked.ok) return unlocked.error.code === 'password-cancelled' ? { kind: 'cancelled' } : { kind: 'error', message: unlocked.error.message };
    const apiKey = backends.keys.getKey(target.provider);
    if (apiKey === null) return { kind: 'error', message: `Add your ${PROVIDER_NAME[target.provider]} key in Settings > Keys` };
    const answer = await backends.createPromptEnhancer(target.provider).enhance({ model: target.modelId, prompt: buildIdeasText(userText), level: target.level }, { apiKey, signal });
    if (signal.aborted) return { kind: 'cancelled' };
    if (!answer.ok) return { kind: 'error', message: answer.error.message };
    const parsed = parseIdeas(answer.value);
    return parsed.ok ? { kind: 'ideas', ideas: parsed.ideas } : { kind: 'error', message: parsed.message };
  } catch {
    return signal.aborted ? { kind: 'cancelled' } : { kind: 'error', message: IDEAS_UNREADABLE };
  }
}
