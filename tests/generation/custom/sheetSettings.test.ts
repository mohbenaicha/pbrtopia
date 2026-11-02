import { describe, expect, it } from 'vitest';
import { findKnownModel } from '../../../src/generation/catalog/knownModels';
import type { ProviderModelRecord } from '../../../src/generation/catalog/modelTypes';
import type { SheetSettings } from '../../../src/generation/custom/planTypes';
import { retargetSettings } from '../../../src/generation/custom/sheetSettings';

const model = (provider: 'gemini' | 'openai', id: string): ProviderModelRecord => {
  const entry = findKnownModel(provider, id);
  if (entry === null) throw new Error(id);
  return entry;
};
const SUNBURST = model('openai', 'gpt-image-2.5-sunburst');
const NANO = model('gemini', 'gemini-nano-banana-2.1');
const before: SheetSettings = { provider: 'openai', modelId: SUNBURST.id, resolutionKey: '2K', quality: 'low' };

describe('retargetSettings (custom R5)', () => {
  it('custom R5 keeps the resolution and the quality the new model also offers', () => {
    const next = retargetSettings(before, SUNBURST, 8192);
    expect(next).toEqual(before);
  });

  it('custom R5 names the new model', () => {
    const next = retargetSettings(before, NANO, 8192);
    expect(next).toMatchObject({ provider: 'gemini', modelId: NANO.id });
  });

  it('custom R5 a resolution the new model lacks becomes its smallest; a quality it lacks becomes its default or null', () => {
    const next = retargetSettings({ ...before, resolutionKey: '4K', quality: 'not-a-level' }, NANO, 8192);
    const smallest = [...NANO.resolutions].sort((a, b) => a.sizePx - b.sizePx)[0]!;
    if (!NANO.resolutions.some((option) => option.key === '4K')) expect(next.resolutionKey).toBe(smallest.key);
    expect(next.quality === null || NANO.qualityLevels.includes(next.quality)).toBe(true);
  });

  it('custom R5 a resolution larger than the GPU takes is not kept', () => {
    const next = retargetSettings({ ...before, resolutionKey: '4K' }, SUNBURST, 2048);
    expect(next.resolutionKey).not.toBe('4K');
  });
});
