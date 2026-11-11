import { describe, expect, it } from 'vitest';
import { KNOWN_MODELS } from '@shared/generation';
import { buildCostHint } from '@mat/generation/cost/buildCostHint';
import { inspectPlan } from '@mat/generation/plan/inspectPlan';
import { withKnownModels } from '@mat/generation/plan/displayCatalog';
import { buildPresetPlan } from '@mat/generation/plan/presetPlans';

const EMPTY = { gemini: [], openai: [] };
const gemini = KNOWN_MODELS.filter((model) => model.provider === 'gemini');
const openai = KNOWN_MODELS.filter((model) => model.provider === 'openai');

describe('materialgen/generation display catalog', () => {
  it('R62 a provider without models lists the shipped table, and one with models keeps its own list', () => {
    expect(withKnownModels(EMPTY)).toEqual({ gemini, openai });
    const discovered = [gemini[0]!];
    expect(withKnownModels({ gemini: discovered, openai: [] })).toEqual({ gemini: discovered, openai });
  });

  it('R62 R65 with no key the hint still shows the plan\'s images while the real inspection keeps the key problem', () => {
    const plan = buildPresetPlan('preset-1', EMPTY, 4096)!;
    const real = inspectPlan(plan, { catalog: EMPTY, hasKey: { gemini: false, openai: false }, describeProvider: null, referenceCount: 0, hasExistingAlbedo: false });
    expect(real.problem).toBe('Add an image model key in Settings');
    expect(buildCostHint(real, 'albedo', 1024, null).summary).toMatch(/^0 images/);
    const preview = inspectPlan(plan, { catalog: withKnownModels(EMPTY), hasKey: { gemini: true, openai: true }, describeProvider: 'gemini', referenceCount: 0, hasExistingAlbedo: true });
    expect(buildCostHint(preview, 'albedo', 1024, null).summary).toMatch(/^4 images/);
  });
});
