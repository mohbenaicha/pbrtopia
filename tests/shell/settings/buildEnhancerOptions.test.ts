import { describe, expect, it } from 'vitest';
import { buildEnhancerOptions } from '../../../src/shell/settings/buildEnhancerOptions';
import type { ModelCatalog, ProviderModelRecord } from '../../../src/generation';

const model = (provider: 'gemini' | 'openai', id: string, role: ProviderModelRecord['role'] = 'vision-text', verified = true): ProviderModelRecord => ({ provider, id, role, displayName: `Name ${id}`, verified, resolutions: [], qualityLevels: [] });

const catalog: ModelCatalog = {
  gemini: [model('gemini', 'g-img', 'image'), model('gemini', 'g-text'), model('gemini', 'g-new', 'vision-text', false)],
  openai: [model('openai', 'o-text')],
  openrouter: [],
};

describe('buildEnhancerOptions', () => {
  it('settings R5 there is no Automatic row; with nothing stored the default is shown: GPT-6 Luna with an OpenAI key, else Gemini 3.8 Flash', () => {
    const full: ModelCatalog = { gemini: [model('gemini', 'gemini-3.8-flash'), model('gemini', 'g-text')], openai: [model('openai', 'gpt-6-luna'), model('openai', 'o-text')], openrouter: [] };
    expect(buildEnhancerOptions({ keyed: ['gemini', 'openai'], catalog: full, stored: null }).value).toBe('openai:gpt-6-luna');
    const built = buildEnhancerOptions({ keyed: ['gemini'], catalog: full, stored: null });
    expect(built.value).toBe('gemini:gemini-3.8-flash');
    expect(built.options.map((option) => option.label)).not.toContain('Automatic');
  });

  it('settings R5 when the default is not in the list the first model is shown', () => {
    expect(buildEnhancerOptions({ keyed: ['gemini'], catalog, stored: null }).value).toBe('gemini:g-text');
  });

  it('settings R5 lists only vision-text models of keyed providers, labelled with provider and name; verified ones grouped per provider, unverified last below a separator', () => {
    const built = buildEnhancerOptions({ keyed: ['gemini', 'openai'], catalog, stored: null });
    expect(built.options).toEqual([
      { value: 'gemini:g-text', label: 'Gemini · Name g-text', group: 'Google' },
      { value: 'openai:o-text', label: 'OpenAI · Name o-text', group: 'OpenAI' },
      { value: 'gemini:g-new', label: 'Gemini · Name g-new (unverified)', separatorBefore: true },
    ]);
  });

  it('settings R5 a deprecated model is listed as "(deprecated)" and disabled, and is never the model shown by default', () => {
    const deprecated: ModelCatalog = { gemini: [], openai: [{ ...model('openai', 'o-old'), deprecated: true }, model('openai', 'o-text')], openrouter: [] };
    const built = buildEnhancerOptions({ keyed: ['openai'], catalog: deprecated, stored: null });
    expect(built.options.find((option) => option.value === 'openai:o-old')).toMatchObject({ label: 'OpenAI · Name o-old (deprecated)', disabled: true });
    expect(built.value).toBe('openai:o-text');
  });

  it('settings R5 a provider without a key contributes nothing', () => {
    const built = buildEnhancerOptions({ keyed: ['openai'], catalog, stored: null });
    expect(built.options.map((option) => option.value)).toEqual(['openai:o-text']);
  });

  it('settings R5 a stored choice in the list is the value', () => {
    const built = buildEnhancerOptions({ keyed: ['gemini'], catalog, stored: { provider: 'gemini', modelId: 'g-text' } });
    expect(built.value).toBe('gemini:g-text');
    expect(built.options).toHaveLength(2);
  });

  it('settings R5 a stored choice outside the list is appended as "(not in the list)" and stays selected', () => {
    const built = buildEnhancerOptions({ keyed: ['gemini'], catalog, stored: { provider: 'openai', modelId: 'o-gone' } });
    expect(built.options.at(-1)).toEqual({ value: 'openai:o-gone', label: 'o-gone (not in the list)' });
    expect(built.value).toBe('openai:o-gone');
  });

  it('settings R5 with no keyed provider no option remains (a stored leftover is still appended)', () => {
    expect(buildEnhancerOptions({ keyed: [], catalog, stored: null })).toEqual({ options: [], value: '' });
  });
});
