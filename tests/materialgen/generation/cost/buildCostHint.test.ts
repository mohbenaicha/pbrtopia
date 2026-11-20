import { describe, expect, it } from 'vitest';
import { KNOWN_MODELS } from '@shared/generation';
import { assignMap, setImageSettings, unassignMap } from '@mat/generation/plan/editPlan';
import { inspectPlan } from '@mat/generation/plan/inspectPlan';
import { buildCostHint } from '@mat/generation/cost/buildCostHint';
import { estimateImageCost } from '@mat/generation/cost/estimateImageCost';
import { ENVIRONMENT, preset } from '../run/runHarness';

const hint = (plan = preset('preset-1'), size: number | null = 1024) => buildCostHint(inspectPlan(plan, ENVIRONMENT), 'albedo', size, 'gpt-6-luna');

describe('materialgen/generation R62 R63 cost hint', () => {
  it('R62 the line gives the number of images, the map size and the cost: preset 1 is four Gemini 1K images', () => {
    expect(hint().summary).toBe('4 images - maps 1024 px - about $0.13');
  });

  it('R62 the rows are one per image and one for the describe step, with model, canvas, layout, tile and cost', () => {
    const rows = hint().rows;
    expect(rows.map((row) => row.label)).toEqual(['Image 1 (Albedo)', 'Image 2 (Normal)', 'Image 3 (Height)', 'Metal-Roughness image', 'Describe step']);
    expect(rows[0]).toMatchObject({ model: 'gemini-nano-banana-2.1', canvas: '1024 x 1024', layout: '1x1', tilePx: 1024, costText: 'about $0.03' });
    expect(rows[4]).toMatchObject({ costText: 'under $0.01', model: 'gpt-6-luna' });
  });

  it('R76 an OpenRouter image has no tabled price, so its row and the total say price unknown', () => {
    const model = KNOWN_MODELS.find((candidate) => candidate.provider === 'openrouter')!;
    expect(estimateImageCost({ modelId: model.id, resolutionKey: '1K', quality: null, canvas: { width: 1024, height: 1024 } })).toBeNull();
    const plan = setImageSettings(preset('preset-1'), 0, { provider: 'openrouter', modelId: model.id, resolutionKey: '1K', quality: null });
    const keyed = { ...ENVIRONMENT, catalog: { ...ENVIRONMENT.catalog, openrouter: KNOWN_MODELS.filter((candidate) => candidate.provider === 'openrouter') }, hasKey: { ...ENVIRONMENT.hasKey, openrouter: true } };
    const row = buildCostHint(inspectPlan(plan, keyed), 'albedo', 1024, null).rows[0]!;
    expect(row).toMatchObject({ model: model.id, costText: 'price unknown' });
  });

  it('R62 the hint follows the plan: packing three maps in one image is one image', () => {
    const packed = assignMap(assignMap(preset('preset-1'), 'normal', 0), 'height', 0);
    expect(hint(packed).summary.startsWith('2 images')).toBe(true);
  });

  it('R62 without the decomposition card there is no describe row and one image fewer', () => {
    const none = hint({ ...preset('preset-1'), decomposition: null });
    expect(none.summary.startsWith('3 images')).toBe(true);
    expect(none.rows.map((row) => row.label)).not.toContain('Describe step');
  });

  it('R63 GPT prices come from the calculator: 1024x1024 medium is about $0.01 on 2.5 and $0.04 on 2.6', () => {
    const canvas = { width: 1024, height: 1024 };
    expect(estimateImageCost({ modelId: 'gpt-image-2.5-sunburst', resolutionKey: '1K', quality: 'medium', canvas })).toBeCloseTo(0.0132, 4);
    expect(estimateImageCost({ modelId: 'gpt-image-2.6-sunburst', resolutionKey: '1K', quality: 'medium', canvas })).toBeCloseTo(0.0435, 4);
    expect(estimateImageCost({ modelId: 'gpt-image-2.6-sunburst', resolutionKey: '1K', quality: 'low', canvas })).toBeCloseTo(0.0247, 4);
  });

  it('R63 a larger canvas costs more, and a price the calculator does not show is unknown', () => {
    const one = { modelId: 'gpt-image-2.5-sunburst', resolutionKey: '2K' as const, quality: 'medium' };
    const small = estimateImageCost({ ...one, canvas: { width: 1024, height: 1024 } })!;
    const large = estimateImageCost({ ...one, canvas: { width: 2048, height: 2048 } })!;
    expect(large).toBeGreaterThan(small);
    expect(estimateImageCost({ modelId: 'gpt-image-2.6-sunburst', resolutionKey: '2.8K', quality: 'max', canvas: { width: 2880, height: 2880 } })).toBeNull();
    expect(estimateImageCost({ modelId: 'gpt-image-2', resolutionKey: '1K', quality: 'low', canvas: { width: 1024, height: 1024 } })).toBeNull();
  });

  it('R63 a model without a price shows "price unknown" on its row and the total reads "at least"; with none known the total is unknown', () => {
    const mixed = setImageSettings(preset('preset-2'), 1, { provider: 'openai', modelId: 'gpt-image-2', resolutionKey: '1K', quality: 'medium' });
    const result = hint(mixed);
    expect(result.rows[1]!.costText).toBe('price unknown');
    expect(result.summary).toMatch(/at least \$/);
    const allUnknown = buildCostHint(inspectPlan({ images: [{ maps: ['albedo'], settings: { provider: 'openai', modelId: 'gpt-image-2', resolutionKey: '1K', quality: 'medium' } }], decomposition: null }, ENVIRONMENT), 'albedo', 1024, null);
    expect(allUnknown.summary).toBe('1 image - maps 1024 px - price unknown');
  });
});

describe('materialgen/generation R64 notices', () => {
  it('R64 tiles smaller than the material size are noted', () => {
    expect(hint(preset('preset-1'), 2048).notices).toContain('tiles 1024 px, maps scaled to 2048');
    expect(hint(preset('preset-1'), 1024).notices).toEqual([]);
  });

  it('R64 a packed Gemini image is noted as JPEG output', () => {
    expect(hint(assignMap(preset('preset-1'), 'normal', 0)).notices).toContain('JPEG output');
  });

  it('R62 with no material size the maps follow the lead tile', () => {
    expect(hint(preset('preset-1'), null).summary).toContain('maps 1024 px');
  });

  it('R62 a plan with no Albedo says it uses the current Albedo, and a plan with Albedo does not', () => {
    const noAlbedo = unassignMap(preset('preset-2'), 'albedo');
    expect(hint(noAlbedo).summary).toBe('3 images - maps 1024 px - about $0.04 - uses the current Albedo');
    expect(hint(preset('preset-2')).summary).not.toContain('current Albedo');
    expect(hint({ images: [], decomposition: preset('preset-2').decomposition }, null).summary).toContain('uses the current Albedo');
    expect(hint({ images: [], decomposition: null }).summary).not.toContain('current Albedo');
  });

  it('R62 with no material size and no lead the maps follow the first map image', () => {
    expect(hint(unassignMap(preset('preset-1'), 'albedo'), null).summary).toContain('maps 1024 px');
  });
});
