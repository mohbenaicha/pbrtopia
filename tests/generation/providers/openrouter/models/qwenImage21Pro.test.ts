import { describe, it } from 'vitest';
import { qwenImage21ProPlugin } from '../../../../../src/generation/providers/openrouter/models/qwenImage21Pro';
import { expectPlugin } from './expectPlugin';

describe('qwen/qwen-image-2.1-pro plug-in (R44, R47)', () => {
  it('R47 offers the sizes, ratios and input limit OpenRouter documents for it', () => {
    expectPlugin(qwenImage21ProPlugin, { id: 'qwen/qwen-image-2.1-pro', keys: ['1K', '2K'], resolutionValues: { '1K': '1K', '2K': '2K' }, maxReferenceImages: 10, ratios: ['1:1', '1:2', '1:4', '2:1', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '9:21'] });
  });
});
