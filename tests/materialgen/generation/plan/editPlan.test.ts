import { describe, expect, it } from 'vitest';
import { addImage, assignMap, listActiveImages, listPlannedMaps, removeImage, setDecompositionIncluded, setImageSettings, syncSettings, unassignMap } from '@mat/generation/plan/editPlan';
import type { GenerationPlan, SheetSettings } from '@mat/generation/plan/planTypes';

const gemini: SheetSettings = { provider: 'gemini', modelId: 'gemini-nano-banana-2.1', resolutionKey: '1K', quality: 'minimal' };
const gpt: SheetSettings = { provider: 'openai', modelId: 'gpt-image-2.5-sunburst', resolutionKey: '1K', quality: 'medium' };

const onePerImage = (): GenerationPlan => ({
  images: [{ maps: ['albedo'], settings: gemini }, { maps: ['height'], settings: gemini }],
  decomposition: gemini,
});

describe('materialgen/generation R5 R11 R13 map assignment', () => {
  it('R11 a map dropped on another image leaves its old image and lands in reading order', () => {
    const plan = assignMap(onePerImage(), 'height', 0);
    expect(plan.images.map((image) => image.maps)).toEqual([['albedo', 'height'], []]);
    const onSecond = assignMap(plan, 'albedo', 1);
    expect(onSecond.images.map((image) => image.maps)).toEqual([['height'], ['albedo']]);
    const together = assignMap(onSecond, 'height', 1);
    expect(together.images.map((image) => image.maps)).toEqual([[], ['albedo', 'height']]);
  });

  it('R5 R11 Albedo can be moved to another image and unassigned like Height', () => {
    const moved = assignMap(onePerImage(), 'albedo', 1);
    expect(moved.images.map((image) => image.maps)).toEqual([[], ['albedo', 'height']]);
    const dropped = unassignMap(onePerImage(), 'albedo');
    expect(dropped.images.map((image) => image.maps)).toEqual([[], ['height']]);
    expect(listPlannedMaps(dropped)).toEqual(['height']);
  });

  it('R11 a map dropped back on the chip row is unassigned, and unassigning a free map changes nothing', () => {
    const plan = unassignMap(onePerImage(), 'height');
    expect(plan.images[1]!.maps).toEqual([]);
    expect(unassignMap(plan, 'height')).toBe(plan);
    expect(listPlannedMaps(plan)).toEqual(['albedo']);
  });

  it('R11 dropping a map on the image that already holds it, or on an image that does not exist, changes nothing', () => {
    const plan = onePerImage();
    expect(assignMap(plan, 'height', 1)).toBe(plan);
    expect(assignMap(plan, 'height', 5)).toBe(plan);
  });

  it('R13 the plan has at most two map images and a new card starts empty with the settings given', () => {
    const one = removeImage(onePerImage(), 1);
    const two = addImage(one, gpt);
    expect(two.images).toHaveLength(2);
    expect(two.images[1]).toEqual({ maps: [], settings: gpt });
    expect(addImage(two, gpt)).toBe(two);
  });

  it('R13 every card can be removed, Image 1 included; removing a card unassigns its maps, and a plan may be left with no map image', () => {
    const plan = onePerImage();
    const removed = removeImage(plan, 1);
    expect(removed.images).toHaveLength(1);
    expect(listPlannedMaps(removed)).toEqual(['albedo']);
    const withoutFirst = removeImage(plan, 0);
    expect(withoutFirst.images).toHaveLength(1);
    expect(listPlannedMaps(withoutFirst)).toEqual(['height']);
    const single: GenerationPlan = { images: [{ maps: ['albedo'], settings: gpt }], decomposition: gpt };
    expect(removeImage(single, 0).images).toEqual([]);
    expect(removeImage(plan, 7)).toBe(plan);
  });

  it('R13 an emptied card stays as a card but is not an active image', () => {
    const plan = assignMap(onePerImage(), 'height', 0);
    expect(plan.images).toHaveLength(2);
    expect(plan.images[1]!.maps).toEqual([]);
    expect(listActiveImages(plan).map((entry) => entry.index)).toEqual([0]);
  });
});

describe('materialgen/generation R15 R17 settings edits', () => {
  it('R13 new settings replace one card only', () => {
    const plan = setImageSettings(onePerImage(), 1, gpt);
    expect(plan.images.map((image) => image.settings.provider)).toEqual(['gemini', 'openai']);
  });

  it('R15 unticking the decomposition card removes it, ticking it again brings it back with the settings given', () => {
    const off = setDecompositionIncluded(onePerImage(), false, gpt);
    expect(off.decomposition).toBeNull();
    expect(setDecompositionIncluded(off, true, gpt).decomposition).toEqual(gpt);
    expect(setDecompositionIncluded(off, false, gpt)).toBe(off);
  });

  it('R17 sync gives every other card, the decomposition card included, the retargeted settings', () => {
    const mixed: GenerationPlan = { images: [{ maps: ['albedo'], settings: gpt }, { maps: ['height'], settings: gemini }], decomposition: gpt };
    const synced = syncSettings(mixed, 1, () => gemini);
    expect(synced.images[0]!.settings).toEqual(gemini);
    expect(synced.images[1]!.settings).toBe(mixed.images[1]!.settings); // the card that changed is left to the caller
    expect(synced.decomposition).toEqual(gemini);
  });

  it('R17 sync from the decomposition card changes the map images and leaves it alone', () => {
    const mixed: GenerationPlan = { images: [{ maps: ['albedo'], settings: gpt }], decomposition: gemini };
    const synced = syncSettings(mixed, 'decomposition', () => gemini);
    expect(synced.images[0]!.settings).toEqual(gemini);
    expect(synced.decomposition).toBe(mixed.decomposition);
  });

  it('R17 the retarget of each card is told how many maps it holds, one for an empty card and for the decomposition card', () => {
    const plan: GenerationPlan = { images: [{ maps: ['albedo', 'height'], settings: gpt }, { maps: [], settings: gpt }], decomposition: gpt };
    const counts: number[] = [];
    syncSettings(plan, 1, (_previous, mapCount) => {
      counts.push(mapCount);
      return gemini;
    });
    expect(counts).toEqual([2, 1]);
  });

  it('R17 sync keeps a missing decomposition card missing', () => {
    const plan: GenerationPlan = { images: [{ maps: ['albedo'], settings: gpt }], decomposition: null };
    expect(syncSettings(plan, 0, () => gemini).decomposition).toBeNull();
  });
});
