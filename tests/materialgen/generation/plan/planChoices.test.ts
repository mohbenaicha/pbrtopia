import { describe, expect, it } from 'vitest';
import { buildPresetPlan } from '@mat/generation/plan/presetPlans';
import { listPlanChoices, readActivePlan, resolvePlanChoice } from '@mat/generation/plan/planChoices';
import { writePlan } from '@mat/generation/plan/planRecord';
import { assignMap } from '@mat/generation/plan/editPlan';
import type { SavedSetup } from '@mat/generation/plan/planTypes';

const catalog = { gemini: [], openai: [] };
const MAX_TEXTURE = 4096;
const preset = (id: string) => buildPresetPlan(id, catalog, MAX_TEXTURE)!;

describe('materialgen/generation plan choices', () => {
  it('R1 the select lists the three presets under Presets, then saved setups under Saved setups, and Custom only when it is the value', () => {
    const saved: SavedSetup[] = [{ name: 'Mine', plan: preset('preset-2') }];
    const options = listPlanChoices(saved, 'preset-1');
    expect(options.map((option) => [option.value, option.group])).toEqual([
      ['preset-1', 'Presets'],
      ['preset-2', 'Presets'],
      ['preset-3', 'Presets'],
      ['saved:Mine', 'Saved setups'],
    ]);
    expect(listPlanChoices([], 'custom').at(-1)).toEqual({ value: 'custom', label: 'Custom' });
  });

  it('R2 choosing a preset builds its plan from the catalog', () => {
    expect(resolvePlanChoice('preset-3', [], catalog, MAX_TEXTURE)).toEqual(preset('preset-3'));
  });

  it('R20 choosing a saved setup loads its plan, and an unknown name or Custom loads nothing', () => {
    const plan = preset('preset-2');
    expect(resolvePlanChoice('saved:Mine', [{ name: 'Mine', plan }], catalog, MAX_TEXTURE)).toEqual(plan);
    expect(resolvePlanChoice('saved:Gone', [], catalog, MAX_TEXTURE)).toBeNull();
    expect(resolvePlanChoice('custom', [], catalog, MAX_TEXTURE)).toBeNull();
  });

  it('R70 the active plan is the stored one, else the stored preset id, else preset 1', () => {
    const edited = assignMap(preset('preset-1'), 'normal', 0);
    expect(readActivePlan({ customPlan: writePlan(edited), presetId: 'preset-2' }, catalog, MAX_TEXTURE)).toEqual(edited);
    expect(readActivePlan({ presetId: 'preset-3' }, catalog, MAX_TEXTURE)).toEqual(preset('preset-3'));
    expect(readActivePlan({ presetId: 'saved:Gone' }, catalog, MAX_TEXTURE)).toEqual(preset('preset-1'));
    expect(readActivePlan({ customPlan: { images: 'broken' }, presetId: 'preset-2' }, catalog, MAX_TEXTURE)).toEqual(preset('preset-2'));
  });
});
