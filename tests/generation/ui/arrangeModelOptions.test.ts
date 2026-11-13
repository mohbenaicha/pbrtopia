import { describe, expect, it } from 'vitest';
import { arrangeModelOptions, type ModelChoice } from '../../../src/generation/ui/arrangeModelOptions';

const choice = (provider: ModelChoice['provider'], displayName: string, extra: Partial<ModelChoice> = {}): ModelChoice => ({ provider, value: `${provider}:${displayName}`, displayName, verified: true, ...extra });
const label = (provider: ModelChoice['provider'], displayName: string) => `${provider}/${displayName}`;

describe('arrangeModelOptions (generate R4, 2026-11-13)', () => {
  it('R4 verified models are grouped under "Google" then "OpenAI", each group sorted by name', () => {
    const options = arrangeModelOptions([choice('openai', 'Beta'), choice('gemini', 'Zeta'), choice('openai', 'Alpha'), choice('gemini', 'Eta')], label);
    expect(options.map((option) => [option.group, option.label])).toEqual([
      ['Google', 'gemini/Eta'], ['Google', 'gemini/Zeta'], ['OpenAI', 'openai/Alpha'], ['OpenAI', 'openai/Beta'],
    ]);
  });

  it('R4 unverified models of every provider come last, sorted by label, with no group, marked, and a separator before the first', () => {
    const options = arrangeModelOptions([choice('openai', 'New', { verified: false }), choice('gemini', 'Old'), choice('gemini', 'Newer', { verified: false })], label);
    expect(options.map((option) => option.label)).toEqual(['gemini/Old', 'gemini/Newer (unverified)', 'openai/New (unverified)']);
    expect(options.map((option) => option.group)).toEqual(['Google', undefined, undefined]);
    expect(options.map((option) => option.separatorBefore === true)).toEqual([false, true, false]);
  });

  it('R4 with only unverified models there is no separator (nothing above it)', () => {
    const options = arrangeModelOptions([choice('openai', 'New', { verified: false })], label);
    expect(options[0]?.separatorBefore).toBeUndefined();
  });

  it('R4 a deprecated model stays in its group, labelled "(deprecated)", and cannot be chosen', () => {
    const options = arrangeModelOptions([choice('openai', 'Old', { deprecated: true }), choice('openai', 'Current')], label);
    expect(options.find((option) => option.value === 'openai:Old')).toMatchObject({ label: 'openai/Old (deprecated)', group: 'OpenAI', disabled: true });
    expect(options.find((option) => option.value === 'openai:Current')?.disabled).toBeUndefined();
  });

  it('R4 an empty list gives no options', () => {
    expect(arrangeModelOptions([], label)).toEqual([]);
  });
});
