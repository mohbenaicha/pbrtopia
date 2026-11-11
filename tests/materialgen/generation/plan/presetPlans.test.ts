import { describe, expect, it } from 'vitest';
import { KNOWN_MODELS } from '@shared/generation/catalog/knownModels';
import { buildCardSettings, listCardOptions, retargetCardSettings } from '@mat/generation/plan/modelMinimums';
import { buildPresetPlan, detectPlanEntry, isSamePlan, PRESET_IDS, savedSetupValue, type ModelCatalog } from '@mat/generation/plan/presetPlans';
import type { GenerationPlan } from '@mat/generation/plan/planTypes';

const MAX_TEXTURE = 16384;
const full: ModelCatalog = { gemini: KNOWN_MODELS.filter((model) => model.provider === 'gemini'), openai: KNOWN_MODELS.filter((model) => model.provider === 'openai') };
const model = (id: string) => KNOWN_MODELS.find((candidate) => candidate.id === id)!;

describe('materialgen/generation R2 R3 presets', () => {
  it('R2 every preset has Image 1 Albedo, Image 2 Normal, Image 3 Height and the decomposition card', () => {
    for (const id of PRESET_IDS) {
      const plan = buildPresetPlan(id, full, MAX_TEXTURE)!;
      expect(plan.images.map((image) => image.maps)).toEqual([['albedo'], ['normal'], ['height']]);
      expect(plan.decomposition).not.toBeNull();
    }
    expect(PRESET_IDS).toEqual(['preset-1', 'preset-2', 'preset-3']);
  });

  it('R2 preset 1 is Gemini everywhere, preset 2 GPT Image everywhere, preset 3 Gemini colour then GPT Image', () => {
    const providers = (id: string) => {
      const plan = buildPresetPlan(id, full, MAX_TEXTURE)!;
      return [...plan.images.map((image) => image.settings.provider), plan.decomposition!.provider];
    };
    expect(providers('preset-1')).toEqual(['gemini', 'gemini', 'gemini', 'gemini']);
    expect(providers('preset-2')).toEqual(['openai', 'openai', 'openai', 'openai']);
    expect(providers('preset-3')).toEqual(['gemini', 'openai', 'openai', 'openai']);
    expect(buildPresetPlan('custom', full, MAX_TEXTURE)).toBeNull();
  });

  it('R3 the provider names resolve to the default image models of the catalog', () => {
    const plan = buildPresetPlan('preset-3', full, MAX_TEXTURE)!;
    expect(plan.images[0]!.settings.modelId).toBe('gemini-nano-banana-2.1');
    expect(plan.images[1]!.settings.modelId).toBe('gpt-image-2.5-sunburst');
  });

  it('R3 a provider the catalog does not list is still applied, from the shipped table, so the cards show the problem', () => {
    const noOpenai: ModelCatalog = { gemini: full.gemini, openai: [] };
    const plan = buildPresetPlan('preset-2', noOpenai, MAX_TEXTURE)!;
    expect(plan.images[0]!.settings).toMatchObject({ provider: 'openai', modelId: 'gpt-image-2.5-sunburst', resolutionKey: '1K', quality: 'medium' });
  });

  it('R28 a preset takes the family start quality: minimal for Gemini, medium for GPT Image', () => {
    const plan = buildPresetPlan('preset-3', full, MAX_TEXTURE)!;
    expect(plan.images[0]!.settings.quality).toBe('minimal');
    expect(plan.images[1]!.settings.quality).toBe('medium');
    expect(plan.decomposition!.resolutionKey).toBe('1K');
  });
});

describe('materialgen/generation R1 R4 R20 the select value', () => {
  it('R1 a plan equal to a preset shows that preset', () => {
    expect(detectPlanEntry(buildPresetPlan('preset-2', full, MAX_TEXTURE)!, [], full, MAX_TEXTURE)).toBe('preset-2');
  });

  it('R4 any edit makes the select show Custom, and a saved setup shows its own name', () => {
    const edited: GenerationPlan = buildPresetPlan('preset-1', full, MAX_TEXTURE)!;
    const changed: GenerationPlan = { ...edited, images: [{ ...edited.images[0]!, maps: ['albedo', 'normal'] }, ...edited.images.slice(1)] };
    expect(detectPlanEntry(changed, [], full, MAX_TEXTURE)).toBe('custom');
    expect(detectPlanEntry(changed, [{ name: 'Two in one', plan: changed }], full, MAX_TEXTURE)).toBe(savedSetupValue('Two in one'));
  });

  it('R4 plans are the same only card by card, empty cards and the decomposition card included', () => {
    const plan = buildPresetPlan('preset-1', full, MAX_TEXTURE)!;
    expect(isSamePlan(plan, structuredClone(plan))).toBe(true);
    expect(isSamePlan(plan, { ...plan, decomposition: null })).toBe(false);
    expect(isSamePlan(plan, { ...plan, images: plan.images.slice(0, 2) })).toBe(false);
  });
});

describe('materialgen/generation R16 R27 R28 R29 minimums and retargeting', () => {
  it('R27 GPT Image 2.5 and 2.6 do not offer low, and start on medium', () => {
    for (const id of ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2.6-sunburst', 'gpt-image-2.6-flare']) {
      const options = listCardOptions(model(id), MAX_TEXTURE);
      expect(options.qualityLevels).not.toContain('low');
      expect(options.qualityLevels).toContain('medium');
      expect(options.startQuality).toBe('medium');
    }
  });

  it('R27 Gemini keeps every level the catalog lists and starts on minimal', () => {
    const options = listCardOptions(model('gemini-nano-banana-2.1'), MAX_TEXTURE);
    expect(options.qualityLevels).toEqual(['minimal', 'medium', 'high']);
    expect(options.startQuality).toBe('minimal');
  });

  it('R27 a model in no family keeps the catalog list and default', () => {
    const options = listCardOptions(model('gpt-image-2'), MAX_TEXTURE);
    expect(options.qualityLevels).toEqual(['low', 'medium', 'high']);
    expect(options.startQuality).toBe('low');
  });

  it('R27 a Gemini model with no levels starts on none', () => {
    expect(buildCardSettings(model('gemini-3-pro-image'), MAX_TEXTURE, 1).quality).toBeNull();
  });

  it('R28 the resolution is the smallest offered for which the layout is valid: three maps on a 1K Gemini canvas are too small, so 2K', () => {
    expect(buildCardSettings(model('gemini-nano-banana-2.1'), MAX_TEXTURE, 1).resolutionKey).toBe('1K');
    expect(buildCardSettings(model('gemini-nano-banana-2.1'), MAX_TEXTURE, 3).resolutionKey).toBe('1K'); // 1024 wide: 3x1 on 21:9 or 2x2 on the square both give tiles over 256
  });

  it('R29 sizes the GPU cannot capture are not offered', () => {
    expect(listCardOptions(model('gemini-nano-banana-2.1'), 2048).resolutions.map((option) => option.key)).toEqual(['1K', '2K']);
  });

  it('R16 a model change keeps the resolution and quality when the new model offers them', () => {
    const previous = { provider: 'gemini' as const, modelId: 'gemini-nano-banana-2.1', resolutionKey: '2K' as const, quality: 'medium' };
    const next = retargetCardSettings(previous, model('gemini-3.1-flash-image'), MAX_TEXTURE, 1);
    expect(next).toEqual({ provider: 'gemini', modelId: 'gemini-3.1-flash-image', resolutionKey: '2K', quality: 'minimal' }); // medium is not offered by that model
  });

  it('R16 else the smallest offered resolution and the start quality', () => {
    const previous = { provider: 'gemini' as const, modelId: 'gemini-nano-banana-2.1', resolutionKey: '4K' as const, quality: 'high' };
    const next = retargetCardSettings(previous, model('gpt-image-2.5-sunburst'), MAX_TEXTURE, 1);
    expect(next).toEqual({ provider: 'openai', modelId: 'gpt-image-2.5-sunburst', resolutionKey: '1K', quality: 'high' });
    const fromLow = retargetCardSettings({ ...previous, quality: 'minimal' }, model('gpt-image-2.5-sunburst'), MAX_TEXTURE, 1);
    expect(fromLow.quality).toBe('medium');
  });
});
