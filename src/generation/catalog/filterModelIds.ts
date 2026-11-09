import type { Provider } from '../../keys';
import { KNOWN_MODELS } from './knownModels';
import type { ProviderModelRecord } from './modelTypes';

// One model as a provider's list endpoint reports it (a Gemini `models/` prefix already removed).
export interface ListedModel {
  id: string;
  shutdownDate?: string | null; // OpenAI `shutdown_date`
  methods?: string[]; // Gemini `supportedGenerationMethods`
}

export interface CandidateModel {
  id: string;
  role: ProviderModelRecord['role'];
  shutdownDate?: string; // a future date: the model is still offered but retiring
}

// The Gemini method name that marks Interactions support. Not known until the live check (G1); null means methods are not checked.
const GEMINI_IMAGE_METHOD: string | null = null;

const PREVIEW_SUFFIX = /-(preview|exp)(-[\w-]+)?$/;
const DATED_SUFFIXES = [/-\d{4}-\d{2}-\d{2}$/, /-\d{3}$/];
const GEMINI_TEXT_EXCLUDED = /-(tts|embedding|live|image)(-|$)/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function roleOf(provider: Provider, id: string): ProviderModelRecord['role'] | null {
  if (provider === 'openai') {
    if (id.startsWith('gpt-image-')) return 'image';
    return KNOWN_MODELS.some((known) => known.provider === 'openai' && known.role === 'vision-text' && known.id === id) ? 'vision-text' : null;
  }
  if (/image|banana/.test(id)) return id.startsWith('gemini-') ? 'image' : null;
  if (id.startsWith('gemini-') && /(flash|pro)/.test(id) && !GEMINI_TEXT_EXCLUDED.test(id)) return 'vision-text';
  return null;
}

// The id without a preview or dated suffix: the plain model a snapshot belongs to.
function baseIdOf(id: string): string {
  let base = id.replace(PREVIEW_SUFFIX, '');
  for (const dated of DATED_SUFFIXES) base = base.replace(dated, '');
  return base;
}

// A model in the shipped table is never dropped for being older than a newer release of its family.
const isShippedTableModel = (provider: Provider, id: string): boolean => KNOWN_MODELS.some((known) => known.provider === provider && known.id === id);

const isVersionToken =(token: string): boolean => /^\d+(\.\d+)*$/.test(token);

// family: the id without its version numbers; version: the first version number, as numbers (empty when there is none).
function familyOf(id: string): { family: string; version: number[] } {
  const tokens = baseIdOf(id).split('-');
  const versionToken = tokens.find(isVersionToken);
  return { family: tokens.filter((token) => !isVersionToken(token)).join('-'), version: versionToken === undefined ? [] : versionToken.split('.').map(Number) };
}

// Number by number; a missing number counts as lower than any present one, so no version is the oldest.
function compareVersions(a: number[], b: number[]): number {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const left = a[index] ?? -1;
    const right = b[index] ?? -1;
    if (left !== right) return left - right;
  }
  return 0;
}

/**
 * Generate R4: the models of a provider's list that the app offers. Keeps the image and vision-text models by id pattern, drops models whose
 * shutdown date is today or past (a future date is kept and passed on), drops dated and preview ids whose plain id is also listed, and keeps
 * only the newest version of each family. The input is not changed; the result keeps the list's order.
 */
export function filterModelIds(provider: Provider, listed: readonly ListedModel[], today: string, requiredGeminiMethod: string | null = GEMINI_IMAGE_METHOD): CandidateModel[] {
  const allIds = new Set(listed.map((model) => model.id));
  const candidates = new Map<string, CandidateModel & { family: string; version: number[] }>();
  for (const model of listed) {
    const role = roleOf(provider, model.id);
    if (role === null || candidates.has(model.id)) continue;
    if (provider === 'gemini' && role === 'image' && requiredGeminiMethod !== null && !(model.methods ?? []).includes(requiredGeminiMethod)) continue;
    const shutdown = typeof model.shutdownDate === 'string' && ISO_DATE.test(model.shutdownDate) ? model.shutdownDate : undefined;
    if (shutdown !== undefined && shutdown <= today) continue;
    const base = baseIdOf(model.id);
    if (base !== model.id && allIds.has(base)) continue;
    candidates.set(model.id, { id: model.id, role, ...(shutdown === undefined ? {} : { shutdownDate: shutdown }), ...familyOf(model.id) });
  }
  const newest = new Map<string, { id: string; version: number[] }>();
  for (const candidate of candidates.values()) {
    const key = `${candidate.role}:${candidate.family}`;
    const best = newest.get(key);
    if (best === undefined || compareVersions(candidate.version, best.version) > 0) newest.set(key, { id: candidate.id, version: candidate.version });
  }
  const winners = new Set([...newest.values()].map((entry) => entry.id));
  return [...candidates.values()].filter((candidate) => winners.has(candidate.id) || isShippedTableModel(provider, candidate.id)).map(({ id, role, shutdownDate }) => ({ id, role, ...(shutdownDate === undefined ? {} : { shutdownDate }) }));
}
