import { describe, it } from 'vitest';
import { maiImage27Plugin } from '../../../../../src/generation/providers/openrouter/models/maiImage27';
import { expectPlugin } from './expectPlugin';

describe('microsoft/mai-image-2.7 plug-in (R44, R47)', () => {
  it('R47 offers the sizes, ratios and input limit OpenRouter documents for it', () => {
    expectPlugin(maiImage27Plugin, { id: 'microsoft/mai-image-2.7', keys: ['1K'], resolutionValues: {}, maxReferenceImages: 5, ratios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'] });
  });
});
