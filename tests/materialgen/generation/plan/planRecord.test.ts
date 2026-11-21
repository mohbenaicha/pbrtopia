import { describe, expect, it } from 'vitest';
import { KNOWN_MODELS } from '@shared/generation/catalog/knownModels';
import { isSamePlan, buildPresetPlan, type ModelCatalog } from '@mat/generation/plan/presetPlans';
import { parseSavedSetups, parseStoredPlan, writePlan, writeSavedSetups } from '@mat/generation/plan/planRecord';

const full: ModelCatalog = { gemini: KNOWN_MODELS.filter((model) => model.provider === 'gemini'), openai: KNOWN_MODELS.filter((model) => model.provider === 'openai'), openrouter: [] };
const plan = buildPresetPlan('preset-3', full, 16384)!;

describe('materialgen/generation R70 persistence of the plan', () => {
  it('R70 a plan written to the record reads back the same, through JSON', () => {
    const back = parseStoredPlan(JSON.parse(JSON.stringify(writePlan(plan))) as Record<string, unknown>);
    expect(back).not.toBeNull();
    expect(isSamePlan(back!, plan)).toBe(true);
  });

  it('R76 a card on an OpenRouter model, no quality, reads back from the project record and from a saved setup', () => {
    const model = KNOWN_MODELS.find((candidate) => candidate.provider === 'openrouter')!;
    const settings = { provider: 'openrouter' as const, modelId: model.id, resolutionKey: '1K' as const, quality: null };
    const onOpenRouter = { images: [{ maps: ['albedo' as const], settings }], decomposition: null };
    const back = parseStoredPlan(JSON.parse(JSON.stringify(writePlan(onOpenRouter))) as Record<string, unknown>);
    expect(back?.images[0]?.settings).toEqual(settings);
    const saved = parseSavedSetups(JSON.parse(JSON.stringify(writeSavedSetups([{ name: 'Seedream', plan: onOpenRouter }]))) as Array<Record<string, unknown>>);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.plan.images[0]!.settings.provider).toBe('openrouter');
    expect(parseStoredPlan({ ...writePlan(onOpenRouter), images: [{ maps: ['albedo'], settings: { ...settings, provider: 'nobody' } }] })).toBeNull();
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
    const onSecond = { ...stored, images: [{ ...stored.images[0]!, maps: [] }, { ...stored.images[1]!, maps: ['albedo', 'height'] }] };
    expect(parseStoredPlan(onSecond)!.images[1]!.maps).toEqual(['albedo', 'height']);
    expect(parseStoredPlan({ images: [], decomposition: stored.decomposition } as never)!.images).toEqual([]);
    const twice = { ...stored, images: [stored.images[0]!, { ...stored.images[1]!, maps: ['albedo'] }] };
    expect(parseStoredPlan(twice)).toBeNull();
    expect(parseStoredPlan({ images: [], decomposition: null })).toBeNull();
  });

  describe('normal-from-height R2 a stored plan that lists Normal is read with Normal removed', () => {
    const oldPlan = (): { images: Array<{ maps: string[]; settings: Record<string, unknown> }>; decomposition: unknown } => {
      const stored = writePlan(plan) as { images: Array<{ maps: string[]; settings: Record<string, unknown> }>; decomposition: unknown };
      const [albedo, height] = stored.images as [typeof stored.images[number], typeof stored.images[number]];
      return { ...stored, images: [albedo, { maps: ['normal'], settings: { ...albedo.settings } }, height] }; // the three-image preset of before the change
    };

    it('an image left with no map is dropped, and the rest of the plan is as stored', () => {
      const back = parseStoredPlan(oldPlan())!;
      expect(back.images.map((image) => image.maps)).toEqual([['albedo'], ['height']]);
      expect(isSamePlan(back, plan)).toBe(true);
    });

    it('Normal shared with other maps in one image is taken out of that image and the image stays', () => {
      const stored = oldPlan();
      stored.images = [{ ...stored.images[0]!, maps: ['albedo', 'normal', 'height'] }];
      expect(parseStoredPlan(stored)!.images.map((image) => image.maps)).toEqual([['albedo', 'height']]);
    });

    it('a card the person left empty stays an empty card', () => {
      const stored = oldPlan();
      stored.images = [stored.images[0]!, { ...stored.images[1]!, maps: [] }];
      expect(parseStoredPlan(stored)!.images.map((image) => image.maps)).toEqual([['albedo'], []]);
    });

    it('an old plan of three cards where none held Normal still reads: the trailing empty card is the one left out', () => {
      const stored = oldPlan();
      stored.images = [stored.images[0]!, stored.images[2]!, { ...stored.images[0]!, maps: [] }];
      expect(parseStoredPlan(stored)!.images.map((image) => image.maps)).toEqual([['albedo'], ['height']]);
    });

    it('only trailing empty cards are left out: a plan still over two cards with an empty one in the middle does not read', () => {
      const stored = oldPlan();
      const [albedo, , height] = stored.images as [typeof stored.images[number], unknown, typeof stored.images[number]];
      const empty = { ...albedo, maps: [] };
      stored.images = [albedo, height, empty, empty];
      expect(parseStoredPlan(stored)!.images.map((image) => image.maps)).toEqual([['albedo'], ['height']]);
      stored.images = [albedo, empty, height];
      expect(parseStoredPlan(stored)).toBeNull();
    });

    it('a plan that held only Normal and no decomposition card reads as nothing, so the panel starts on preset 1', () => {
      const stored = oldPlan();
      stored.images = [stored.images[1]!];
      stored.decomposition = null;
      expect(parseStoredPlan(stored)).toBeNull();
    });

    it('a saved setup is cleaned the same way', () => {
      const rows = [{ name: 'Old full', plan: oldPlan() }];
      const back = parseSavedSetups(rows as never);
      expect(back).toHaveLength(1);
      expect(back[0]!.plan.images.map((image) => image.maps)).toEqual([['albedo'], ['height']]);
    });

    it('a map name that is not a known map still makes the plan unreadable', () => {
      const stored = oldPlan();
      stored.images = [{ ...stored.images[0]!, maps: ['albedo', 'roughness'] }];
      expect(parseStoredPlan(stored)).toBeNull();
    });
  });

  it('R19 a model id the catalog does not list is kept as written', () => {
    const stored = writePlan(plan) as { images: Array<{ settings: Record<string, unknown> }> };
    stored.images[1]!.settings['modelId'] = 'gone-model';
    expect(parseStoredPlan(stored as never)!.images[1]!.settings.modelId).toBe('gone-model');
  });

  it('R70 more than two map images does not read', () => {
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
