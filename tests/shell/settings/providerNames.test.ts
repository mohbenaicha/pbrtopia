import { describe, expect, it } from 'vitest';
import { PROVIDER_NAMES } from '../../../src/shell/settings/providerNames';

describe('PROVIDER_NAMES', () => {
  it('settings R4 names Gemini and OpenAI the way the key rows and warnings show them', () => {
    expect(PROVIDER_NAMES).toEqual({ gemini: 'Gemini', openai: 'OpenAI' });
  });
});
