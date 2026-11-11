import { describe, expect, it } from 'vitest';
import { KNOWN_MODELS } from '@shared/generation/catalog/knownModels';
import { isSamePlan, buildPresetPlan, type ModelCatalog } from '@mat/generation/plan/presetPlans';
import { parseSavedSetups, parseStoredPlan, writePlan, writeSavedSetups } from '@mat/generation/plan/planRecord';

const full: ModelCatalog = { gemini: KNOWN_MODELS.filter((model) => model.provider === 'gemini'), openai: KNOWN_MODELS.filter((model) => model.provider === 'openai') };
const plan = buildPresetPlan('preset-3', full, 16384)!;

describe('materialgen/generation R70 persistence of the plan', () => {
  it('R70 a plan written to the record reads back the same, through JSON', () => {
    const back = parseStoredPlan(JSON.parse(JSON.stringify(writePlan(plan))) as Record<string, unknown>);
    expect(back).not.toBeNull();
    expect(isSamePlan(back!, plan)).toBe(true);
  });

  it('R70 a project with no saved plan, or one that does not read, gives null so the panel starts on preset 1', () => {
    expect(parseStoredPlan(undefined)).toBeNull();
    expect(parseStoredPlan({ images: [], decomposition: null })).toBeNull();
    expect(parseStoredPlan({ ...writePlan(plan), images: 'x' })).toBeNull();
  });

  it('R5 a plan with no Albedo, with Albedo on any image, or with the decomposition card alone reads back; a plan that names a map twice, or holds nothing, does not', () => {
    const stored = writePlan(plan) as { images: Array<{ maps: string[] }>; decomposition: unknown };
    const noAlbedo = { ...stored, images: [{ ...stored.images[0]!, maps: [] }, ...stored.images.slice(1)] };
    expect(parseStoredPlan(noAlbedo)).not.toBeNull();
    const onSecond = { ...stored, images: [{ ...stored.images[0]!, maps: [] }, { ...stored.images[1]!, maps: ['albedo', 'normal'] }, stored.images[2]!] };
    expect(parseStoredPlan(onSecond)!.images[1]!.maps).toEqual(['albedo', 'normal']);
    expect(parseStoredPlan({ images: [], decomposition: stored.decomposition } as never)!.images).toEqual([]);
    const twice = { ...stored, images: [stored.images[0]!, { ...stored.images[1]!, maps: ['albedo'] }, stored.images[2]!] };
    expect(parseStoredPlan(twice)).toBeNull();
    expect(parseStoredPlan({ images: [], decomposition: null })).toBeNull();
  });

  it('R19 a model id the catalog does not list is kept as written', () => {
    const stored = writePlan(plan) as { images: Array<{ settings: Record<string, unknown> }> };
    stored.images[1]!.settings['modelId'] = 'gone-model';
    expect(parseStoredPlan(stored as never)!.images[1]!.settings.modelId).toBe('gone-model');
  });

  it('R70 more than three images does not read', () => {
    const stored = writePlan(plan) as { images: unknown[] };
    expect(parseStoredPlan({ ...stored, images: [...stored.images, stored.images[1]] } as never)).toBeNull();
  });

  it('R20 saved setups read back with their names; an unreadable one and a repeated name are left out', () => {
    const rows = writeSavedSetups([{ name: 'All Gemini', plan }, { name: 'All Gemini', plan }]);
    const withBad = [...rows, { name: 'Broken', plan: { images: [] } }, { plan }];
    const back = parseSavedSetups(withBad as never);
    expect(back.map((setup) => setup.name)).toEqual(['All Gemini']);
    expect(isSamePlan(back[0]!.plan, plan)).toBe(true);
  });
});
