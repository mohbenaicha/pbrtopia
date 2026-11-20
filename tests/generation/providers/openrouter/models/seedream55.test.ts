import { describe, it } from 'vitest';
import { seedream55Plugin } from '../../../../../src/generation/providers/openrouter/models/seedream55';
import { expectPlugin } from './expectPlugin';

describe('bytedance-seed/seedream-5-5 plug-in (R44, R47)', () => {
  it('R47 offers the sizes, ratios and input limit OpenRouter documents for it', () => {
    expectPlugin(seedream55Plugin, { id: 'bytedance-seed/seedream-5-5', keys: ['1K', '2K'], resolutionValues: { '1K': '1K', '2K': '2K' }, maxReferenceImages: 10, ratios: ['1:1', '1:2', '2:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '9:19.5', '19.5:9', '9:20', '20:9', '9:21', '21:9'] });
  });
});
