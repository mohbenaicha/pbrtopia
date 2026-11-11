import { describe, expect, it, vi } from 'vitest';
import type { PromptEnhancer } from '@shared/generation';
import { IDEAS_UNREADABLE } from '@mat/generation/ideas/parseIdeas';
import { requestPromptIdeas, type IdeasBackends } from '@mat/generation/ideas/requestPromptIdeas';
import { buildIdeasText } from '@mat/generation/ideas/buildIdeasText';

const TARGET = { provider: 'gemini' as const, modelId: 'gemini-3.8-flash', level: 'low' };

function backends(answer: Awaited<ReturnType<PromptEnhancer['enhance']>>, options: { key?: string | null; unlock?: Awaited<ReturnType<IdeasBackends['keys']['ensureUnlocked']>> } = {}) {
  const enhance = vi.fn<PromptEnhancer['enhance']>(async () => answer);
  const deps: IdeasBackends = {
    createPromptEnhancer: vi.fn(() => ({ enhance })),
    keys: { getKey: () => (options.key === undefined ? 'k-123' : options.key), ensureUnlocked: async () => options.unlock ?? { ok: true, value: undefined } },
  };
  return { deps, enhance };
}

describe('requestPromptIdeas', () => {
  it('materialgen/generation R72 sends one text-only request to the chosen model with its level and the built text, and returns the ideas', async () => {
    const { deps, enhance } = backends({ ok: true, value: '["a", "b", "c"]' });
    const outcome = await requestPromptIdeas(TARGET, 'rusty metal', deps, new AbortController().signal);
    expect(outcome).toEqual({ kind: 'ideas', ideas: ['a', 'b', 'c'] });
    expect(enhance).toHaveBeenCalledTimes(1);
    const [request, context] = enhance.mock.calls[0]!;
    expect(request).toEqual({ model: 'gemini-3.8-flash', prompt: buildIdeasText('rusty metal'), level: 'low' });
    expect('image' in request).toBe(false);
    expect(context.apiKey).toBe('k-123');
  });

  it('materialgen/generation R72 a provider error shows its own message', async () => {
    const { deps } = backends({ ok: false, error: { category: 'rate-limit', retryable: true, message: 'Too many requests' } });
    expect(await requestPromptIdeas(TARGET, 'x', deps, new AbortController().signal)).toEqual({ kind: 'error', message: 'Too many requests' });
  });

  it('materialgen/generation R72 an answer that cannot be read is the unreadable error', async () => {
    const { deps } = backends({ ok: true, value: 'Sure! Here you go: rust' });
    expect(await requestPromptIdeas(TARGET, 'x', deps, new AbortController().signal)).toEqual({ kind: 'error', message: IDEAS_UNREADABLE });
  });

  it('materialgen/generation R72 a missing key is the error line of R65 and no call is made', async () => {
    const { deps, enhance } = backends({ ok: true, value: '[]' }, { key: null });
    expect(await requestPromptIdeas(TARGET, 'x', deps, new AbortController().signal)).toEqual({ kind: 'error', message: 'Add your Gemini key in Settings > Keys' });
    expect(enhance).not.toHaveBeenCalled();
  });

  it('materialgen/generation R72 a cancelled unlock question starts no call and shows no error', async () => {
    const { deps, enhance } = backends({ ok: true, value: '[]' }, { unlock: { ok: false, error: { code: 'password-cancelled', message: 'cancelled' } } as never });
    expect(await requestPromptIdeas(TARGET, 'x', deps, new AbortController().signal)).toEqual({ kind: 'cancelled' });
    expect(enhance).not.toHaveBeenCalled();
  });

  it('materialgen/generation R72 an answer that arrives after the request was aborted is discarded', async () => {
    const controller = new AbortController();
    const { deps, enhance } = backends({ ok: true, value: '["a", "b", "c"]' });
    enhance.mockImplementation(async () => {
      controller.abort();
      return { ok: true, value: '["a", "b", "c"]' };
    });
    expect(await requestPromptIdeas(TARGET, 'x', deps, controller.signal)).toEqual({ kind: 'cancelled' });
  });
});
