import { describe, expect, it, vi } from 'vitest';
import { refreshModelLists } from '../../../src/shell/settings/refreshModelLists';
import type { ProviderError, ProviderModelRecord, Result } from '../../../src/generation';
import type { Provider } from '../../../src/keys';
import { resolved } from '../../keys/fakeResolveKey';

const model = (provider: Provider, id: string): ProviderModelRecord => ({ provider, id, role: 'vision-text', displayName: id, verified: true, resolutions: [], qualityLevels: [] });
const NOW = '2026-10-21T12:00:00.000Z';
const failure = (category: ProviderError['category'], message = 'It failed.'): Result<ProviderModelRecord[], ProviderError> => ({ ok: false, error: { category, retryable: false, message } });
const unlocked = { ok: true as const, value: undefined };

type Discover = (provider: Provider, key: string, signal: AbortSignal) => Promise<Result<ProviderModelRecord[], ProviderError>>;

function run(options: { keyed?: Provider[]; unlock?: unknown; keys?: Partial<Record<Provider, string | null>>; discover?: Discover; previous?: Parameters<typeof refreshModelLists>[0]['previous'] } = {}) {
  const discover = vi.fn(options.discover ?? (async (provider: Provider) => ({ ok: true as const, value: [model(provider, `${provider}-new`)] })));
  const keys = { gemini: 'g-secret-key', openai: 'o-secret-key', ...options.keys };
  const deps = {
    keyed: options.keyed ?? (['gemini', 'openai'] as Provider[]),
    vault: { ensureUnlocked: vi.fn(async () => (options.unlock ?? unlocked) as never), resolveKey: async (provider: Provider) => resolved(keys[provider] ?? null) },
    discover,
    previous: options.previous ?? null,
    now: () => NOW,
  };
  return { deps, discover, result: refreshModelLists(deps) };
}

const previous = { fetchedAt: '2026-01-01T00:00:00.000Z', gemini: [{ ...model('gemini', 'g-old') }], openai: [{ ...model('openai', 'o-old') }] };

describe('refreshModelLists', () => {
  it('settings R6 a dismissed password question gives cancelled and asks nothing', async () => {
    const { result, discover } = run({ unlock: { ok: false, error: { code: 'password-cancelled', message: 'No password was entered.' } } });
    expect(await result).toEqual({ status: 'cancelled' });
    expect(discover).not.toHaveBeenCalled();
  });

  it('settings R6 any other unlock failure gives unlock-failed with its message', async () => {
    const { result, discover } = run({ unlock: { ok: false, error: { code: 'wrong-password', message: 'That password is not right.' } } });
    expect(await result).toEqual({ status: 'unlock-failed', message: 'That password is not right.' });
    expect(discover).not.toHaveBeenCalled();
  });

  it('settings R6 every provider answering stores both new lists with one fetchedAt', async () => {
    const outcome = await run().result;
    expect(outcome).toMatchObject({ status: 'done', problems: [] });
    if (outcome.status !== 'done') throw new Error('expected done');
    expect(outcome.patch?.fetchedAt).toBe(NOW);
    expect(outcome.patch?.gemini.map((entry) => entry['id'])).toEqual(['gemini-new']);
    expect(outcome.patch?.openai.map((entry) => entry['id'])).toEqual(['openai-new']);
  });

  it('settings R6 a refused key keeps that provider\'s previous list and names it', async () => {
    const outcome = await run({ previous, discover: async (provider) => (provider === 'gemini' ? failure('auth') : { ok: true, value: [model('openai', 'o-new')] }) }).result;
    if (outcome.status !== 'done') throw new Error('expected done');
    expect(outcome.problems).toEqual(['Gemini refused the key.']);
    expect(outcome.patch?.gemini.map((entry) => entry['id'])).toEqual(['g-old']);
    expect(outcome.patch?.openai.map((entry) => entry['id'])).toEqual(['o-new']);
  });

  it('settings R6 a key that cannot be read is named and not asked for', async () => {
    const { result, discover } = run({ keys: { gemini: null } });
    const outcome = await result;
    if (outcome.status !== 'done') throw new Error('expected done');
    expect(outcome.problems).toEqual(['Gemini key could not be read.']);
    expect(discover).toHaveBeenCalledTimes(1);
    expect(discover.mock.calls[0]?.[0]).toBe('openai');
  });

  it('settings R6 another failure names the provider with its message', async () => {
    const outcome = await run({ discover: async (provider) => (provider === 'openai' ? failure('network-or-blocked', 'Could not reach OpenAI.') : { ok: true, value: [model('gemini', 'g-new')] }) }).result;
    if (outcome.status !== 'done') throw new Error('expected done');
    expect(outcome.problems).toEqual(['OpenAI: Could not reach OpenAI.']);
  });

  it('settings R6 when every provider fails nothing is written', async () => {
    const outcome = await run({ previous, discover: async () => failure('server', 'Server error.') }).result;
    expect(outcome).toEqual({ status: 'done', patch: null, problems: ['Gemini: Server error.', 'OpenAI: Server error.'] });
  });

  it('settings R6 a provider without a key keeps its previous entries in the patch', async () => {
    const outcome = await run({ keyed: ['gemini'], previous }).result;
    if (outcome.status !== 'done') throw new Error('expected done');
    expect(outcome.patch?.openai.map((entry) => entry['id'])).toEqual(['o-old']);
  });

  it('settings R6 a provider with no key and no previous list is stored empty, never omitted', async () => {
    const outcome = await run({ keyed: ['gemini'] }).result;
    if (outcome.status !== 'done') throw new Error('expected done');
    expect(outcome.patch?.openai).toEqual([]);
  });

  it('settings R6 the keys never appear in the outcome', async () => {
    const outcome = await run({ previous, discover: async () => failure('auth') }).result;
    expect(JSON.stringify(outcome)).not.toContain('secret-key');
  });
});
