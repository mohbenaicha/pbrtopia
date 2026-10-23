import { describe, expect, it, vi } from 'vitest';
import { findKnownModel, findStaleKnownModels, KNOWN_MODELS, warnAboutStaleKnownModels } from '../../../src/generation/catalog/knownModels';

const TODAY = '2026-10-19';
const ids = (provider: string): string[] => KNOWN_MODELS.filter((entry) => entry.provider === provider).map((entry) => entry.id).sort();

describe('knownModels', () => {
  it('R4 the shipped table is the verified table of providers.md 4.4 without the models past or at their shutdown', () => {
    expect(ids('gemini')).toEqual(['gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-nano-banana-2.1']);
    expect(ids('openai')).toEqual(['gpt-5.6-luna', 'gpt-6-astra', 'gpt-6-luna', 'gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']);
    expect(findKnownModel('openai', 'gpt-image-1')).toBeNull();
    expect(findKnownModel('gemini', 'gemini-2.5-flash-image')).toBeNull();
  });

  it('R4 no entry has a shutdown date in the past, every id appears once per provider, and every entry is verified', () => {
    for (const entry of KNOWN_MODELS) {
      if (entry.retiring) expect(entry.retiring.shutdownDate > TODAY, entry.id).toBe(true);
      expect(entry.verified, entry.id).toBe(true);
    }
    const keys = KNOWN_MODELS.map((entry) => `${entry.provider}/${entry.id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('R4 image models offer the sizes of the data model: Gemini 1K/2K/4K (flash lite 1K only), OpenAI 1K/2K/2.8K with 2K and 2.8K experimental', () => {
    const sizes = (provider: 'gemini' | 'openai', id: string) => findKnownModel(provider, id)?.resolutions.map((r) => `${r.key}=${r.sizePx}`);
    expect(sizes('gemini', 'gemini-nano-banana-2.1')).toEqual(['1K=1024', '2K=2048', '4K=4096']);
    expect(sizes('gemini', 'gemini-3.1-flash-image')).toEqual(['1K=1024', '2K=2048', '4K=4096']);
    expect(sizes('gemini', 'gemini-3.1-flash-lite-image')).toEqual(['1K=1024']);
    expect(sizes('openai', 'gpt-image-2.5-sunburst')).toEqual(['1K=1024', '2K=2048', '2.8K=2880']);
    expect(findKnownModel('openai', 'gpt-image-2.5-sunburst')?.experimentalResolutions).toEqual(['2K', '2.8K']);
    expect(findKnownModel('gemini', 'gemini-nano-banana-2.1')?.experimentalResolutions ?? []).toEqual([]);
  });

  it('R5 quality levels are the provider\'s own names and are not renamed or folded', () => {
    const levels = (provider: 'gemini' | 'openai', id: string) => findKnownModel(provider, id)?.qualityLevels;
    expect(levels('gemini', 'gemini-nano-banana-2.1')).toEqual(['minimal', 'medium', 'high']);
    expect(levels('gemini', 'gemini-3.1-flash-image')).toEqual(['minimal', 'high']);
    expect(levels('gemini', 'gemini-3.1-flash-lite-image')).toEqual(['minimal', 'high']);
    expect(levels('openai', 'gpt-image-2.5-sunburst')).toEqual(['low', 'medium', 'high', 'xhigh', 'max', 'auto']);
    expect(levels('openai', 'gpt-image-2.5-flare')).toEqual(['low', 'medium', 'high', 'xhigh', 'max', 'auto']);
    expect(levels('openai', 'gpt-image-2')).toEqual(['low', 'medium', 'high']);
  });

  it('R5 a model whose levels are unconfirmed (gemini-3-pro-image) and the text models offer no levels', () => {
    for (const [provider, id] of [['gemini', 'gemini-3-pro-image'], ['gemini', 'gemini-3.8-flash'], ['gemini', 'gemini-3.5-flash-lite'], ['openai', 'gpt-6-astra'], ['openai', 'gpt-5.6-luna'], ['openai', 'gpt-6-luna']] as const) {
      expect(findKnownModel(provider, id)?.qualityLevels, id).toEqual([]);
    }
  });

  it('R8 gpt-6-luna is a verified vision-text model, dated 2026-10-23 and sourced from the live probes', () => {
    const luna = findKnownModel('openai', 'gpt-6-luna');
    expect(luna).toMatchObject({ role: 'vision-text', displayName: 'GPT-6 Luna', verified: true, verifiedAt: '2026-10-23' });
    expect(luna?.source.length).toBeGreaterThan(0);
  });

  it('R8 the enhancer level is held only by the four vision-text rows the spec names, with the values seen accepted', () => {
    const withLevel = KNOWN_MODELS.filter((entry) => entry.enhancerLevel !== undefined).map((entry) => `${entry.id}=${entry.enhancerLevel}`).sort();
    expect(withLevel).toEqual(['gemini-3.8-flash=low', 'gpt-5.6-luna=none', 'gpt-6-astra=low', 'gpt-6-luna=none']);
    for (const entry of KNOWN_MODELS) if (entry.enhancerLevel !== undefined) expect(entry.role, entry.id).toBe('vision-text');
  });

  it('R5 the default level of each model is one of its levels, and a model without levels has no default', () => {
    for (const entry of KNOWN_MODELS) {
      if (entry.qualityLevels.length > 0) expect(entry.qualityLevels, entry.id).toContain(entry.defaultQuality);
      else expect(entry.defaultQuality, entry.id).toBeUndefined();
    }
    expect(findKnownModel('gemini', 'gemini-nano-banana-2.1')?.defaultQuality).toBe('medium');
    expect(findKnownModel('gemini', 'gemini-3.1-flash-image')?.defaultQuality).toBe('minimal');
    expect(findKnownModel('openai', 'gpt-image-2.5-flare')?.defaultQuality).toBe('auto');
  });

  it('R4 text models have the vision-text role and no sizes; image models have the image role and at least one size', () => {
    for (const entry of KNOWN_MODELS) {
      if (entry.role === 'image') expect(entry.resolutions.length, entry.id).toBeGreaterThan(0);
      else expect(entry.resolutions, entry.id).toEqual([]);
    }
    expect(findKnownModel('openai', 'gpt-6-astra')?.role).toBe('vision-text');
    expect(findKnownModel('gemini', 'gemini-3.8-flash')?.role).toBe('vision-text');
  });

  it('R4 experimental resolutions are keys the model offers, the reference cap is set for Gemini images, and each entry is dated and sourced', () => {
    for (const entry of KNOWN_MODELS) {
      const keys = entry.resolutions.map((r) => r.key);
      for (const key of entry.experimentalResolutions ?? []) expect(keys, entry.id).toContain(key);
      expect(entry.verifiedAt, entry.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.source.length, entry.id).toBeGreaterThan(0);
    }
    expect(findKnownModel('gemini', 'gemini-nano-banana-2.1')?.maxReferenceImages).toBe(14);
  });

  it('R4 findKnownModel returns a copy, so changing it does not change the table', () => {
    const first = findKnownModel('openai', 'gpt-image-2');
    first?.qualityLevels.push('changed');
    expect(findKnownModel('openai', 'gpt-image-2')?.qualityLevels).toEqual(['low', 'medium', 'high']);
  });

  it('R4 findStaleKnownModels lists entries verified more than 90 days before the given day, and none on the day they were verified', () => {
    expect(findStaleKnownModels(KNOWN_MODELS, '2026-10-17')).toEqual([]);
    expect(findStaleKnownModels(KNOWN_MODELS, '2027-01-15')).toEqual([]); // 90 days exactly
    expect(findStaleKnownModels(KNOWN_MODELS, '2027-01-16').length).toBe(KNOWN_MODELS.filter((entry) => entry.verifiedAt === '2026-10-17').length);
  });

  it('R4 warnAboutStaleKnownModels prints one line naming the stale models and the day they were checked, and nothing when none is stale', () => {
    const warn = vi.fn();
    warnAboutStaleKnownModels(KNOWN_MODELS, '2026-10-19', warn);
    expect(warn).not.toHaveBeenCalled();
    warnAboutStaleKnownModels(KNOWN_MODELS, '2027-01-16', warn);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0]?.[0]);
    expect(line).toContain('gpt-image-2');
    expect(line).toContain('gemini-nano-banana-2.1');
    expect(line).toContain('2026-10-17');
  });
});
