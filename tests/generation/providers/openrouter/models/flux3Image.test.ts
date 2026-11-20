import { describe, it } from 'vitest';
import { flux3ImagePlugin } from '../../../../../src/generation/providers/openrouter/models/flux3Image';
import { expectPlugin } from './expectPlugin';

describe('black-forest-labs/flux-3-image plug-in (R44, R47)', () => {
  it('R47 offers the sizes, ratios and input limit OpenRouter documents for it', () => {
    expectPlugin(flux3ImagePlugin, { id: 'black-forest-labs/flux-3-image', keys: ['1K', '2K', '4K'], resolutionValues: { '1K': '1K', '2K': '2K', '4K': '4K' }, maxReferenceImages: 10, ratios: ['21:9', '2:1', '16:9', '3:2', '7:5', '4:3', '5:4', '1:1', '4:5', '3:4', '5:7', '2:3', '9:16', '1:2', '9:21'] });
  });
});
