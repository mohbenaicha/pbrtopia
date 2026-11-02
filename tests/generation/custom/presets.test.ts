import { describe, expect, it } from 'vitest';
import { findKnownModel } from '../../../src/generation/catalog/knownModels';
import { buildPresetPlan, detectPreset, pickPresetModel } from '../../../src/generation/custom/presets';
import type { ProviderModelRecord } from '../../../src/generation/catalog/modelTypes';
import type { Provider } from '../../../src/keys';
import { assignCamera } from '../../../src/generation/custom/planEditing';

const sunburst = findKnownModel('openai', 'gpt-image-2.5-sunburst')!;
const cameras = (plan: ReturnType<typeof buildPresetPlan>) => plan.sheets.map((sheet) => sheet.cameras);

describe('buildPresetPlan', () => {
  it('custom R4 Default is Front; Back; Left+Right; Top+Bottom; Aux', () => {
    const plan = buildPresetPlan('default', sunburst);
    expect(cameras(plan)).toEqual([[0], [2], [1, 3], [4, 5]]);
    expect(plan.aux).not.toBeNull();
  });

  it('custom R4 2-2-2 is Front+Back; Left+Right; Top+Bottom; Aux', () => {
    const plan = buildPresetPlan('two-two-two', sunburst);
    expect(cameras(plan)).toEqual([[0, 2], [1, 3], [4, 5]]);
    expect(plan.aux).not.toBeNull();
  });

  it('custom R4 3 images is Front+Left+Right; Back+Top+Bottom; Aux', () => {
    const plan = buildPresetPlan('three-images', sunburst);
    expect(cameras(plan)).toEqual([[0, 1, 3], [2, 4, 5]]);
    expect(plan.aux).not.toBeNull();
  });

  it('custom R4 every sheet uses sunburst, low quality and the smallest resolution', () => {
    for (const preset of ['default', 'two-two-two', 'three-images'] as const) {
      const plan = buildPresetPlan(preset, sunburst);
      for (const settings of [...plan.sheets.map((s) => s.settings), plan.aux!.settings]) {
        expect(settings).toEqual({ provider: 'openai', modelId: 'gpt-image-2.5-sunburst', resolutionKey: '1K', quality: 'low' });
      }
    }
  });

  it('custom R4 a model without quality levels gives a null quality, and the lowest level is used when low is not offered', () => {
    const gemini = findKnownModel('gemini', 'gemini-nano-banana-2.1')!;
    expect(buildPresetPlan('default', gemini).sheets[0]!.settings.quality).toBe('minimal');
    const pro = findKnownModel('gemini', 'gemini-3-pro-image')!;
    expect(buildPresetPlan('default', pro).sheets[0]!.settings.quality).toBeNull();
  });

  it('custom R4 applying a preset twice gives equal plans that share nothing', () => {
    const one = buildPresetPlan('default', sunburst);
    const two = buildPresetPlan('default', sunburst);
    expect(one).toEqual(two);
    one.sheets[0]!.cameras.push(5);
    expect(two.sheets[0]!.cameras).toEqual([0]);
  });
});

describe('pickPresetModel', () => {
  const asImage = (provider: Provider, id: string, verified = true) => ({ ...sunburst, provider, id, role: 'image', verified }) as ProviderModelRecord;
  const keys = (gemini: boolean, openai: boolean): Record<Provider, boolean> => ({ gemini, openai });

  it('custom R4 sunburst is chosen when listed and verified, whatever keys exist', () => {
    const catalog = { gemini: [asImage('gemini', 'g1')], openai: [sunburst] };
    expect(pickPresetModel(catalog, keys(true, false))).toBe(sunburst);
  });

  it('custom R4 without sunburst the first verified image model of a keyed provider is used, Gemini first', () => {
    const catalog = { gemini: [asImage('gemini', 'g-unverified', false), asImage('gemini', 'g1')], openai: [asImage('openai', 'o1')] };
    expect(pickPresetModel(catalog, keys(true, true))?.id).toBe('g1');
    expect(pickPresetModel(catalog, keys(false, true))?.id).toBe('o1');
  });

  it('custom R4 no sunburst and no usable keyed model gives null', () => {
    const catalog = { gemini: [asImage('gemini', 'g1')], openai: [asImage('openai', 'o1', false)] };
    expect(pickPresetModel(catalog, keys(false, true))).toBeNull();
    expect(pickPresetModel(catalog, keys(false, false))).toBeNull();
  });
});

describe('detectPreset', () => {
  it('custom R4 a preset plan is recognised by its name', () => {
    expect(detectPreset(buildPresetPlan('two-two-two', sunburst), sunburst)).toBe('two-two-two');
  });

  it('custom R4 any edit after a preset makes the plan Custom', () => {
    const edited = assignCamera(buildPresetPlan('default', sunburst), 0, 1);
    expect(detectPreset(edited, sunburst)).toBe('custom');
  });
});
