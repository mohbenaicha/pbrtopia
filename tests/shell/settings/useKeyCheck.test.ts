// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useKeyCheck } from '../../../src/shell/settings/useKeyCheck';
import type { ProviderError, ProviderModelRecord, Result } from '../../../src/generation';
import type { Provider } from '../../../src/keys';

type Answer = Result<ProviderModelRecord[], ProviderError>;
const refused: Answer = { ok: false, error: { category: 'auth', retryable: false, message: 'Rejected.' } };
const offline: Answer = { ok: false, error: { category: 'network-or-blocked', retryable: true, message: 'Offline.' } };
const good: Answer = { ok: true, value: [] };

function fakeVault(keyed: Provider[]) {
  const listeners = new Set<() => void>();
  const have = new Set(keyed);
  const texts: Partial<Record<Provider, string>> = {};
  let status: 'none' | 'locked' | 'unlocked' = 'unlocked';
  return {
    status: () => status,
    hasKey: (provider: Provider) => have.has(provider),
    getKey: (provider: Provider) => (have.has(provider) && status === 'unlocked' ? (texts[provider] ?? `${provider}-key`) : null),
    replaceText(provider: Provider, text: string) {
      texts[provider] = text; // another tab saved a different key: the vault announces it like any change
      listeners.forEach((listener) => listener());
    },
    on: (_event: 'status-changed', listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    change(next: { status?: typeof status; add?: Provider; remove?: Provider }) {
      if (next.status) status = next.status;
      if (next.add) have.add(next.add);
      if (next.remove) have.delete(next.remove);
      listeners.forEach((listener) => listener());
    },
  };
}

type Discover = (provider: Provider, key: string, signal: AbortSignal) => Promise<Answer>;

function setup(options: { keyed?: Provider[]; discover?: Discover } = {}) {
  const vault = fakeVault(options.keyed ?? ['gemini']);
  const discover = vi.fn<Discover>(options.discover ?? (async () => good));
  const hook = renderHook(() => useKeyCheck(vault, discover));
  return { vault, discover, ...hook };
}

describe('useKeyCheck', () => {
  it('settings R4 makes no call on mount, unlock or any status change', async () => {
    const { vault, discover } = setup();
    act(() => vault.change({ status: 'locked' }));
    act(() => vault.change({ status: 'unlocked' }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(discover).not.toHaveBeenCalled();
  });

  it('settings R4 a saved key is checked once with that provider, and an auth failure flags it', async () => {
    const { result, discover } = setup({ discover: async () => refused });
    act(() => result.current.keySaved('gemini'));
    await waitFor(() => expect(result.current.flags.gemini).toBe('Gemini refused this key. Check it and replace it.'));
    expect(discover).toHaveBeenCalledTimes(1);
    expect(discover.mock.calls[0]?.[0]).toBe('gemini');
    expect(discover.mock.calls[0]?.[1]).toBe('gemini-key');
  });

  it('settings R4 an answer that is not an auth failure flags nothing', async () => {
    const { result, discover } = setup({ discover: async () => offline });
    act(() => result.current.keySaved('gemini'));
    await waitFor(() => expect(discover).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(result.current.flags).toEqual({});
  });

  it('settings R4 saving the same text again checks again, and a good answer clears an earlier flag', async () => {
    const answers: Answer[] = [refused, good];
    const { result, discover } = setup({ discover: async () => answers.shift() ?? good });
    act(() => result.current.keySaved('gemini'));
    await waitFor(() => expect(result.current.flags.gemini).toBeDefined());
    act(() => result.current.keySaved('gemini'));
    expect(result.current.flags.gemini).toBeUndefined(); // cleared before the new answer
    await waitFor(() => expect(discover).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(result.current.flags).toEqual({});
  });

  it('settings R4 an older answer cannot replace a newer save\'s result', async () => {
    const resolvers: ((answer: Answer) => void)[] = [];
    const { result } = setup({ discover: () => new Promise<Answer>((resolve) => void resolvers.push(resolve)) });
    act(() => result.current.keySaved('gemini'));
    act(() => result.current.keySaved('gemini'));
    resolvers[1]?.(good);
    await act(async () => undefined);
    resolvers[0]?.(refused); // the first save's answer arrives last and is dropped
    await act(async () => undefined);
    expect(result.current.flags).toEqual({});
  });

  it('settings R4 an answer for a key removed meanwhile flags nothing', async () => {
    let finish: (answer: Answer) => void = () => undefined;
    const { result, vault } = setup({ discover: () => new Promise<Answer>((resolve) => void (finish = resolve)) });
    act(() => result.current.keySaved('gemini'));
    act(() => vault.change({ remove: 'gemini' }));
    finish(refused);
    await act(async () => undefined);
    expect(result.current.flags).toEqual({});
  });

  it('settings R4 removing the key clears its flag; locking keeps it; the flag of another provider is untouched', async () => {
    const { result, vault } = setup({ keyed: ['gemini', 'openai'], discover: async () => refused });
    act(() => result.current.keySaved('gemini'));
    act(() => result.current.keySaved('openai'));
    await waitFor(() => expect(Object.keys(result.current.flags)).toHaveLength(2));
    act(() => vault.change({ status: 'locked' }));
    expect(Object.keys(result.current.flags)).toHaveLength(2);
    act(() => vault.change({ remove: 'gemini' }));
    expect(result.current.flags.gemini).toBeUndefined();
    expect(result.current.flags.openai).toBeDefined();
  });

  it('settings R4 the vault becoming empty clears every flag', async () => {
    const { result, vault } = setup({ discover: async () => refused });
    act(() => result.current.keySaved('gemini'));
    await waitFor(() => expect(result.current.flags.gemini).toBeDefined());
    act(() => vault.change({ status: 'none', remove: 'gemini' }));
    expect(result.current.flags).toEqual({});
  });

  it('settings R4 a key that cannot be read makes no call', () => {
    const { result, discover, vault } = setup();
    act(() => vault.change({ status: 'locked' }));
    act(() => result.current.keySaved('gemini'));
    expect(discover).not.toHaveBeenCalled();
  });

  it('settings R4 an answer for a key replaced from another tab meanwhile flags nothing', async () => {
    let finish: (answer: Answer) => void = () => undefined;
    const { result, vault } = setup({ discover: () => new Promise<Answer>((resolve) => void (finish = resolve)) });
    act(() => result.current.keySaved('gemini'));
    act(() => vault.replaceText('gemini', 'gemini-key-from-the-other-tab'));
    finish(refused);
    await act(async () => undefined);
    expect(result.current.flags).toEqual({});
  });

  it('settings R4 a refusal still flags when the vault was locked meanwhile (the key cannot be compared)', async () => {
    let finish: (answer: Answer) => void = () => undefined;
    const { result, vault } = setup({ discover: () => new Promise<Answer>((resolve) => void (finish = resolve)) });
    act(() => result.current.keySaved('gemini'));
    act(() => vault.change({ status: 'locked' }));
    finish(refused);
    await waitFor(() => expect(result.current.flags.gemini).toBeDefined());
  });

  it('settings R4 a save that completes after the view was left starts no check', () => {
    const { result, discover, unmount } = setup();
    const keySaved = result.current.keySaved; // the key section still holds this callback when its save finishes later
    unmount();
    keySaved('gemini');
    expect(discover).not.toHaveBeenCalled();
  });

  it('settings R4 leaving aborts the call in flight', () => {
    let signal: AbortSignal | undefined;
    const { result, unmount } = setup({
      discover: (_provider, _key, given) => {
        signal = given;
        return new Promise<Answer>(() => undefined);
      },
    });
    act(() => result.current.keySaved('gemini'));
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
