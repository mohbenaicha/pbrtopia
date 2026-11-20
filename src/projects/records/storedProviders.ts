// The provider names the stored records may hold (generate R43). Repeated here because the project store does not import keys/ (A3, A5);
// a test checks that it equals keys' PROVIDERS, so a new provider cannot be forgotten.
export const STORED_PROVIDERS = ['gemini', 'openai', 'openrouter'] as const;
export type StoredProvider = (typeof STORED_PROVIDERS)[number];
