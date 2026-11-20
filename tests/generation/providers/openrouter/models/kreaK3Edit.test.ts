import { describe, it } from 'vitest';
import { kreaK3EditPlugin } from '../../../../../src/generation/providers/openrouter/models/kreaK3Edit';
import { expectPlugin } from './expectPlugin';

describe('krea/k3-edit plug-in (R44, R47)', () => {
  it('R47 offers the sizes, ratios and input limit OpenRouter documents for it', () => {
    expectPlugin(kreaK3EditPlugin, { id: 'krea/k3-edit', keys: ['1K', '2K'], resolutionValues: { '1K': '1K', '2K': '2K' }, maxReferenceImages: 8, ratios: ['1:1', '4:3', '3:2', '16:9', '4:5', '2:3', '9:16'] });
  });
});
