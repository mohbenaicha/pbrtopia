import type { Provider } from '../../keys';
import type { KnownModelEntry, ResolutionOption } from './modelTypes';

const VERIFIED_AT = '2026-10-17';
const GEMINI_DOCS = ['ai.google.dev image-generation', 'ai.google.dev pricing'];
const OPENAI_DOCS = ['developers.openai.com models', 'developers.openai.com pricing'];

const GEMINI_SIZES: ResolutionOption[] = [{ key: '1K', sizePx: 1024 }, { key: '2K', sizePx: 2048 }, { key: '4K', sizePx: 4096 }];
// OpenAI has no 4K square: the largest valid square is 2880 x 2880. 2K and 2.8K are above 2560 x 1440, which the provider calls experimental.
const OPENAI_SIZES: ResolutionOption[] = [{ key: '1K', sizePx: 1024 }, { key: '2K', sizePx: 2048 }, { key: '2.8K', sizePx: 2880 }];
const OPENAI_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max', 'auto'];

// The models the app knows (research/api/providers.md section 4.4, verified 2026-10-17). Models at or near their shutdown date
// (gpt-image-1, gemini-2.5-flash-image) are not listed. The Gemini text models are not confirmed to take an image until the live check (G1).
export const KNOWN_MODELS: readonly KnownModelEntry[] = [
  { provider: 'gemini', id: 'gemini-nano-banana-2.1', role: 'image', displayName: 'Nano Banana 2.1', verified: true, resolutions: GEMINI_SIZES, qualityLevels: ['minimal', 'medium', 'high'], defaultQuality: 'medium', maxReferenceImages: 14, verifiedAt: VERIFIED_AT, source: GEMINI_DOCS },
  { provider: 'gemini', id: 'gemini-3.1-flash-image', role: 'image', displayName: 'Gemini 3.1 Flash Image', verified: true, resolutions: GEMINI_SIZES, qualityLevels: ['minimal', 'high'], defaultQuality: 'minimal', maxReferenceImages: 14, verifiedAt: VERIFIED_AT, source: GEMINI_DOCS },
  { provider: 'gemini', id: 'gemini-3.1-flash-lite-image', role: 'image', displayName: 'Gemini 3.1 Flash Lite Image', verified: true, resolutions: [{ key: '1K', sizePx: 1024 }], qualityLevels: ['minimal', 'high'], defaultQuality: 'minimal', maxReferenceImages: 14, verifiedAt: VERIFIED_AT, source: GEMINI_DOCS },
  { provider: 'gemini', id: 'gemini-3-pro-image', role: 'image', displayName: 'Gemini 3 Pro Image', verified: true, resolutions: GEMINI_SIZES, qualityLevels: [], maxReferenceImages: 14, verifiedAt: VERIFIED_AT, source: GEMINI_DOCS },
  // enhancerLevel (spec generate R8): a value the provider accepted in the live probes of 2026-10-23.
  // gemini-3.5-flash-lite has none: `low` made it think more than its default.
  { provider: 'gemini', id: 'gemini-3.8-flash', role: 'vision-text', displayName: 'Gemini 3.8 Flash', verified: true, resolutions: [], qualityLevels: [], enhancerLevel: 'low', verifiedAt: VERIFIED_AT, source: ['ai.google.dev models', 'ai.google.dev pricing'] },
  { provider: 'gemini', id: 'gemini-3.5-flash-lite', role: 'vision-text', displayName: 'Gemini 3.5 Flash Lite', verified: true, resolutions: [], qualityLevels: [], verifiedAt: VERIFIED_AT, source: ['ai.google.dev models', 'ai.google.dev pricing'] },
  { provider: 'openai', id: 'gpt-image-2.5-sunburst', role: 'image', displayName: 'GPT Image 2.5 Sunburst', verified: true, resolutions: OPENAI_SIZES, qualityLevels: OPENAI_LEVELS, defaultQuality: 'auto', experimentalResolutions: ['2K', '2.8K'], verifiedAt: VERIFIED_AT, source: OPENAI_DOCS },
  { provider: 'openai', id: 'gpt-image-2.5-flare', role: 'image', displayName: 'GPT Image 2.5 Flare', verified: true, resolutions: OPENAI_SIZES, qualityLevels: OPENAI_LEVELS, defaultQuality: 'auto', experimentalResolutions: ['2K', '2.8K'], verifiedAt: VERIFIED_AT, source: OPENAI_DOCS },
  // Levels low..high; the provider's default for this model is unconfirmed, so the app's default is medium.
  { provider: 'openai', id: 'gpt-image-2', role: 'image', displayName: 'GPT Image 2', verified: true, resolutions: OPENAI_SIZES, qualityLevels: ['low', 'medium', 'high'], defaultQuality: 'medium', experimentalResolutions: ['2K', '2.8K'], verifiedAt: VERIFIED_AT, source: OPENAI_DOCS },
  { provider: 'openai', id: 'gpt-6-astra', role: 'vision-text', displayName: 'GPT-6 Astra', verified: true, resolutions: [], qualityLevels: [], verifiedAt: VERIFIED_AT, source: ['developers.openai.com images-vision', 'developers.openai.com pricing'] },
  { provider: 'openai', id: 'gpt-6-luna', role: 'vision-text', displayName: 'GPT-6 Luna', verified: true, resolutions: [], qualityLevels: [], enhancerLevel: 'none', verifiedAt: '2026-10-23', source: ['OpenAI models list (live, 2026-10-23)', 'research/api/live-check.md enhancer probes'] },
  { provider: 'openai', id: 'gpt-5.6-luna', role: 'vision-text', displayName: 'GPT-5.6 Luna', verified: true, resolutions: [], qualityLevels: [], enhancerLevel: 'none', verifiedAt: VERIFIED_AT, source: ['developers.openai.com pricing'] },
];

const STALE_AFTER_DAYS = 90;
const DAY_MS = 86_400_000;

// A copy of the table row for this model, or null when the model is not in the table; the caller may change the copy.
export function findKnownModel(provider: Provider, id: string): KnownModelEntry | null {
  const entry = KNOWN_MODELS.find((candidate) => candidate.provider === provider && candidate.id === id);
  return entry ? structuredClone(entry) : null;
}

// Rows verified more than 90 days before `today` (YYYY-MM-DD): the table needs another look.
export function findStaleKnownModels(entries: readonly KnownModelEntry[], today: string): KnownModelEntry[] {
  const now = Date.parse(today);
  return entries.filter((entry) => (now - Date.parse(entry.verifiedAt)) / DAY_MS > STALE_AFTER_DAYS);
}

// The dev-time warning: one line naming the rows that are more than 90 days old, nothing when none is. The caller of the catalog
// (the model picker, G6) calls it in development builds; it is not run at import.
export function warnAboutStaleKnownModels(entries: readonly KnownModelEntry[], today: string, warn: (line: string) => void = console.warn): void {
  const stale = findStaleKnownModels(entries, today);
  if (stale.length === 0) return;
  const checked = [...new Set(stale.map((entry) => entry.verifiedAt))].sort().join(', ');
  warn(`Known models last checked ${checked} (more than ${STALE_AFTER_DAYS} days before ${today}): ${stale.map((entry) => entry.id).join(', ')}. Check research/api/providers.md 4.4 again.`);
}
