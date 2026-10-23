import type { Provider } from '../../keys';
import type { ProviderError, Result } from '../providers/providerTypes';
import { sendProviderRequest } from '../providers/sendProviderRequest';
import { filterModelIds, type CandidateModel, type ListedModel } from './filterModelIds';
import { findKnownModel } from './knownModels';
import type { ProviderModelRecord } from './modelTypes';

interface DiscoverDeps {
  fetchImpl?: typeof fetch;
  today?: string; // YYYY-MM-DD; today by default
}

const GEMINI_LIST_URL = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000';
const OPENAI_LIST_URL = 'https://api.openai.com/v1/models';
const MAX_GEMINI_PAGES = 10;

const asRecord = (value: unknown): Record<string, unknown> | null => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
const entriesOf = (body: unknown, field: string): Record<string, unknown>[] => {
  const list = asRecord(body)?.[field];
  return Array.isArray(list) ? list.map(asRecord).filter((entry): entry is Record<string, unknown> => entry !== null) : [];
};

const parseOpenAiList = (body: unknown): ListedModel[] =>
  entriesOf(body, 'data').flatMap((entry) => (typeof entry.id === 'string' ? [{ id: entry.id, shutdownDate: typeof entry.shutdown_date === 'string' ? entry.shutdown_date : null }] : []));

const parseGeminiList = (body: unknown): ListedModel[] =>
  entriesOf(body, 'models').flatMap((entry) => {
    if (typeof entry.name !== 'string') return [];
    const methods = Array.isArray(entry.supportedGenerationMethods) ? entry.supportedGenerationMethods.filter((method): method is string => typeof method === 'string') : [];
    return [{ id: entry.name.replace(/^models\//, ''), methods }];
  });

// A candidate as the app shows it: the table row for a known id (without its bookkeeping), a bare unverified entry for any other.
function joinWithKnownTable(provider: Provider, candidate: CandidateModel): ProviderModelRecord {
  const known = findKnownModel(provider, candidate.id);
  const retiring = candidate.shutdownDate === undefined ? {} : { retiring: { shutdownDate: candidate.shutdownDate } };
  if (known !== null) {
    const info = Object.fromEntries(Object.entries(known).filter(([key]) => key !== 'verifiedAt' && key !== 'source')) as unknown as ProviderModelRecord;
    return { ...info, ...retiring };
  }
  return { provider, id: candidate.id, role: candidate.role, displayName: candidate.id, verified: false, resolutions: [], qualityLevels: [], ...retiring };
}

const sortKey = (model: ProviderModelRecord): string => `${model.role === 'image' ? 0 : 1}|${model.verified ? 0 : 1}|${model.id}`;

async function listGemini(apiKey: string, signal: AbortSignal, fetchImpl: typeof fetch): Promise<Result<ListedModel[], ProviderError>> {
  const listed: ListedModel[] = [];
  let pageToken = '';
  for (let page = 0; page < MAX_GEMINI_PAGES; page += 1) {
    const url = pageToken === '' ? GEMINI_LIST_URL : `${GEMINI_LIST_URL}&pageToken=${encodeURIComponent(pageToken)}`;
    const answer = await sendProviderRequest({ provider: 'gemini', url, method: 'GET', headers: { 'x-goog-api-key': apiKey } }, { apiKey, signal }, fetchImpl);
    if (!answer.ok) return answer;
    listed.push(...parseGeminiList(answer.value));
    const next = asRecord(answer.value)?.nextPageToken;
    if (typeof next !== 'string' || next === '') break;
    pageToken = next;
  }
  return { ok: true, value: listed };
}

/**
 * Generate R4: the models the stored key can use, for the model picker. Lists the provider's models, filters them (filterModelIds) and joins
 * them with the shipped table; ids not in the table come back unverified with no sizes or levels. Sorted image models first, verified before
 * unverified, then by id. A failed call returns its ProviderError (401 or 403 means the key is bad); nothing partial is returned.
 */
export async function discoverModels(provider: Provider, apiKey: string, signal: AbortSignal, deps: DiscoverDeps = {}): Promise<Result<ProviderModelRecord[], ProviderError>> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const today = deps.today ?? new Date().toISOString().slice(0, 10);
  let listed: Result<ListedModel[], ProviderError>;
  if (provider === 'gemini') listed = await listGemini(apiKey, signal, fetchImpl);
  else {
    const answer = await sendProviderRequest({ provider, url: OPENAI_LIST_URL, method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } }, { apiKey, signal }, fetchImpl);
    listed = answer.ok ? { ok: true, value: parseOpenAiList(answer.value) } : answer;
  }
  if (!listed.ok) return listed;
  const models = filterModelIds(provider, listed.value, today).map((candidate) => joinWithKnownTable(provider, candidate));
  return { ok: true, value: models.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1)) };
}
