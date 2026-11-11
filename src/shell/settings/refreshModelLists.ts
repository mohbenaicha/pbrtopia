import type { discoverModels } from '../../generation';
import { PROVIDERS, type KeyVault, type Provider } from '../../keys';
import type { CatalogCacheRecord } from '../../projects/records/appSettingsRecord';
import { PROVIDER_NAMES } from './providerNames';

interface RefreshDeps {
  keyed: Provider[];
  vault: Pick<KeyVault, 'ensureUnlocked' | 'getKey'>;
  discover: typeof discoverModels;
  previous: CatalogCacheRecord | null;
  now(): string;
}

type RefreshOutcome =
  | { status: 'cancelled' }
  | { status: 'unlock-failed'; message: string }
  | { status: 'done'; patch: CatalogCacheRecord | null; problems: string[] };

type Answer = { entries: Record<string, unknown>[] } | { problem: string };

async function askProvider(provider: Provider, deps: RefreshDeps, signal: AbortSignal): Promise<Answer> {
  const key = deps.vault.getKey(provider);
  if (key === null) return { problem: `${PROVIDER_NAMES[provider]} key could not be read.` };
  const result = await deps.discover(provider, key, signal);
  if (result.ok) return { entries: result.value as unknown as Record<string, unknown>[] };
  const { category, message } = result.error;
  return { problem: category === 'auth' ? `${PROVIDER_NAMES[provider]} refused the key.` : `${PROVIDER_NAMES[provider]}: ${message}` };
}

/**
 * Settings R6: asks each keyed provider for its models (unlocking the vault first). A provider that fails keeps its previous list;
 * the patch is null when none answered. Only model ids and names leave this function, never a key.
 */
export async function refreshModelLists(deps: RefreshDeps): Promise<RefreshOutcome> {
  const unlocked = await deps.vault.ensureUnlocked();
  if (!unlocked.ok) return unlocked.error.code === 'password-cancelled' ? { status: 'cancelled' } : { status: 'unlock-failed', message: unlocked.error.message };

  const signal = new AbortController().signal; // a refresh that outlives the page is still stored (R6), so nothing aborts it
  const answers = await Promise.all(deps.keyed.map(async (provider) => [provider, await askProvider(provider, deps, signal)] as const));
  const patch: CatalogCacheRecord = { fetchedAt: deps.now(), gemini: [], openai: [] };
  const problems: string[] = [];
  let answered = false;
  for (const provider of PROVIDERS) {
    const answer = answers.find(([name]) => name === provider)?.[1];
    if (answer !== undefined && 'entries' in answer) {
      patch[provider] = answer.entries;
      answered = true;
    } else {
      patch[provider] = deps.previous?.[provider] ?? [];
      if (answer !== undefined) problems.push(answer.problem);
    }
  }
  return { status: 'done', patch: answered ? patch : null, problems };
}
