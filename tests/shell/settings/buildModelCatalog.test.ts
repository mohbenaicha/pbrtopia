import { describe, expect, it } from 'vitest';
import { buildModelCatalog } from '../../../src/shell/settings/buildModelCatalog';
import { KNOWN_MODELS } from '../../../src/generation';
import type { ProviderModelRecord } from '../../../src/generation';

const shipped = (provider: 'gemini' | 'openai'): ProviderModelRecord[] => KNOWN_MODELS.filter((model) => model.provider === provider);

describe('buildModelCatalog', () => {
  it('R20 holds the shipped image and enhancer models of a provider that has a key', () => {
    const catalog = buildModelCatalog(['gemini']);
    expect(catalog.gemini).toEqual(shipped('gemini'));
    expect(catalog.gemini.some((model) => model.role === 'image')).toBe(true);
    expect(catalog.gemini.some((model) => model.role === 'vision-text')).toBe(true);
  });

  it('R43 (generate) an OpenRouter key offers the plug-in models, all image models, from the shipped table', () => {
    const catalog = buildModelCatalog(['openrouter']);
    expect(catalog.openrouter.length).toBeGreaterThan(0);
    expect(catalog.openrouter.every((model) => model.provider === 'openrouter' && model.role === 'image' && model.verified)).toBe(true);
    expect(catalog.openrouter).toEqual(KNOWN_MODELS.filter((model) => model.provider === 'openrouter'));
    expect(buildModelCatalog(['gemini']).openrouter).toEqual([]);
  });

  it('R20 holds nothing for a provider without a key', () => {
    expect(buildModelCatalog(['gemini']).openai).toEqual([]);
    expect(buildModelCatalog([])).toEqual({ gemini: [], openai: [], openrouter: [] });
  });

  it('R20 a discovered list replaces the shipped list of its provider only', () => {
    const found: ProviderModelRecord = { provider: 'openai', id: 'gpt-image-9-mystery', role: 'image', displayName: 'gpt-image-9-mystery', verified: false, resolutions: [], qualityLevels: [] };
    const catalog = buildModelCatalog(['gemini', 'openai'], { openai: [found] });
    expect(catalog.openai).toEqual([found]);
    expect(catalog.gemini).toEqual(shipped('gemini'));
  });

  it('R20 a discovered list of a provider without a key is not used', () => {
    const found: ProviderModelRecord = { provider: 'openai', id: 'gpt-image-9-mystery', role: 'image', displayName: 'x', verified: false, resolutions: [], qualityLevels: [] };
    expect(buildModelCatalog(['gemini'], { openai: [found] }).openai).toEqual([]);
  });
});
