// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PromptEnhancer } from '@shared/generation';
import { usePromptIdeas } from '@mat/generation/ideas/usePromptIdeas';
import type { IdeasBackends } from '@mat/generation/ideas/requestPromptIdeas';

afterEach(cleanup);

const TARGET = { provider: 'gemini' as const, modelId: 'gemini-3.8-flash', level: null };

function setup(options: { answer?: string; target?: typeof TARGET | null; prompt?: string } = {}) {
  const enhance = vi.fn<PromptEnhancer['enhance']>(async () => ({ ok: true, value: options.answer ?? '["one two", "three four", "five six"]' }));
  const backends: IdeasBackends = { createPromptEnhancer: () => ({ enhance }), keys: { getKey: () => 'k', ensureUnlocked: async () => ({ ok: true, value: undefined }) } };
  const hook = renderHook(() => {
    const [prompt, setPrompt] = useState(options.prompt ?? 'rusty metal');
    return { prompt, setPrompt, ideas: usePromptIdeas({ prompt, setPrompt, target: options.target === undefined ? TARGET : options.target, backends }) };
  });
  return { hook, enhance };
}

describe('usePromptIdeas', () => {
  it('materialgen/generation R71 Get prompt ideas is blocked with a reason for a blank field and for no enhancer key', () => {
    expect(setup({ prompt: '   ' }).hook.result.current.ideas.disabledReason).toBe('Write a prompt first');
    expect(setup({ target: null }).hook.result.current.ideas.disabledReason).toBe('Add an OpenAI or Gemini key in Settings > Keys');
    expect(setup().hook.result.current.ideas.disabledReason).toBeNull();
  });

  it('materialgen/generation R72 a good answer becomes the set and leaves the field unchanged; the ideas call runs once while busy', async () => {
    const { hook, enhance } = setup();
    act(() => {
      hook.result.current.ideas.request();
      hook.result.current.ideas.request(); // a second press while the first runs is ignored
    });
    expect(hook.result.current.ideas.busy).toBe(true);
    await waitFor(() => expect(hook.result.current.ideas.ideas).toEqual(['one two', 'three four', 'five six']));
    expect(enhance).toHaveBeenCalledTimes(1);
    expect(hook.result.current.prompt).toBe('rusty metal');
    expect(hook.result.current.ideas.busy).toBe(false);
    expect(hook.result.current.ideas.canReset).toBe(false);
  });

  it('materialgen/generation R72 an unreadable answer shows the error and keeps the earlier set; the next pick clears the error', async () => {
    const { hook, enhance } = setup();
    act(() => hook.result.current.ideas.request());
    await waitFor(() => expect(hook.result.current.ideas.ideas).toHaveLength(3));
    enhance.mockResolvedValueOnce({ ok: true, value: 'nope' });
    act(() => hook.result.current.ideas.request());
    await waitFor(() => expect(hook.result.current.ideas.error).toBe('The ideas could not be read. Try again.'));
    expect(hook.result.current.ideas.ideas).toHaveLength(3);
    act(() => hook.result.current.ideas.pick(0));
    expect(hook.result.current.ideas.error).toBeNull();
  });

  it('materialgen/generation R73 R74 picking puts the idea in the field and selects it; Reset walks back to what the user wrote', async () => {
    const { hook } = setup();
    act(() => hook.result.current.ideas.request());
    await waitFor(() => expect(hook.result.current.ideas.ideas).toHaveLength(3));
    act(() => hook.result.current.ideas.pick(1));
    expect(hook.result.current.prompt).toBe('three four');
    expect(hook.result.current.ideas.selected).toBe(1);
    expect(hook.result.current.ideas.canReset).toBe(true);
    act(() => hook.result.current.ideas.reset());
    expect(hook.result.current.prompt).toBe('rusty metal');
    expect(hook.result.current.ideas.selected).toBeNull();
    expect(hook.result.current.ideas.canReset).toBe(false);
  });

  it('materialgen/generation R72 a request still running when the panel closes is aborted and its answer writes nothing', async () => {
    let signalSeen: AbortSignal | undefined;
    const enhance = vi.fn<PromptEnhancer['enhance']>(
      (_request, context) =>
        new Promise((resolve) => {
          signalSeen = context.signal;
          context.signal.addEventListener('abort', () => resolve({ ok: true, value: '["a b", "c d", "e f"]' }));
        }),
    );
    const backends: IdeasBackends = { createPromptEnhancer: () => ({ enhance }), keys: { getKey: () => 'k', ensureUnlocked: async () => ({ ok: true, value: undefined }) } };
    const hook = renderHook(() => usePromptIdeas({ prompt: 'x', setPrompt: () => undefined, target: TARGET, backends }));
    act(() => hook.result.current.request());
    await waitFor(() => expect(signalSeen).toBeDefined());
    hook.unmount();
    expect(signalSeen?.aborted).toBe(true);
  });
});
