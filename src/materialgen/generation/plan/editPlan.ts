import { MAX_MAP_IMAGES, PLAN_MAPS, type GenerationPlan, type MapImagePlan, type PlanMap, type SheetSettings } from './planTypes';

// Generation R4, R5, R11, R13, R15, R17: pure edits of a plan. Each returns the plan it was given when the edit is not allowed, so a caller can tell by identity.

const inReadingOrder = (maps: readonly PlanMap[]): PlanMap[] => PLAN_MAPS.filter((map) => maps.includes(map));

function withImages(plan: GenerationPlan, images: MapImagePlan[]): GenerationPlan {
  return { ...plan, images };
}

/** R11: moves a map to an image (Albedo like the others); an image that does not exist refuses. */
export function assignMap(plan: GenerationPlan, map: PlanMap, imageIndex: number): GenerationPlan {
  if (plan.images[imageIndex] === undefined) return plan;
  if (plan.images[imageIndex].maps.includes(map)) return plan;
  const images = plan.images.map((image, index) => {
    const others = image.maps.filter((held) => held !== map);
    return { ...image, maps: index === imageIndex ? inReadingOrder([...others, map]) : others };
  });
  return withImages(plan, images);
}

/** R11: drops a map back on the chip row. */
export function unassignMap(plan: GenerationPlan, map: PlanMap): GenerationPlan {
  if (!plan.images.some((image) => image.maps.includes(map))) return plan;
  return withImages(plan, plan.images.map((image) => ({ ...image, maps: image.maps.filter((held) => held !== map) })));
}

/** R13: appends an empty card with the given settings, up to two map images. */
export function addImage(plan: GenerationPlan, settings: SheetSettings): GenerationPlan {
  if (plan.images.length >= MAX_MAP_IMAGES) return plan;
  return withImages(plan, [...plan.images, { maps: [], settings: { ...settings } }]);
}

/** R13: removes a card, Image 1 included; its maps become unassigned. */
export function removeImage(plan: GenerationPlan, imageIndex: number): GenerationPlan {
  if (plan.images[imageIndex] === undefined) return plan;
  return withImages(plan, plan.images.filter((_, index) => index !== imageIndex));
}

/** R13, R16: new settings for one card (the caller has already retargeted them for a model change). */
export function setImageSettings(plan: GenerationPlan, imageIndex: number, settings: SheetSettings): GenerationPlan {
  if (plan.images[imageIndex] === undefined) return plan;
  return withImages(plan, plan.images.map((image, index) => (index === imageIndex ? { ...image, settings: { ...settings } } : image)));
}

/** R15: ticks or unticks the decomposition card; ticking uses the settings given. */
export function setDecompositionIncluded(plan: GenerationPlan, included: boolean, settings: SheetSettings): GenerationPlan {
  if (included === (plan.decomposition !== null)) return plan;
  return { ...plan, decomposition: included ? { ...settings } : null };
}

/** R15: new settings for the included decomposition card. */
export function setDecompositionSettings(plan: GenerationPlan, settings: SheetSettings): GenerationPlan {
  return plan.decomposition === null ? plan : { ...plan, decomposition: { ...settings } };
}

/** R17: Sync settings. Every card other than the one that changed takes `retarget(its settings, its map count)`; the decomposition card is a card too, with one map. */
export function syncSettings(plan: GenerationPlan, changedImage: number | 'decomposition', retarget: (previous: SheetSettings, mapCount: number) => SheetSettings): GenerationPlan {
  const images = plan.images.map((image, index) => (index === changedImage ? image : { ...image, settings: retarget(image.settings, Math.max(1, image.maps.length)) }));
  const decomposition = plan.decomposition === null || changedImage === 'decomposition' ? plan.decomposition : retarget(plan.decomposition, 1);
  return { images, decomposition };
}

/** R13: the images that make a call; an empty card is ignored by Confirm and by the run. */
export function listActiveImages(plan: GenerationPlan): Array<{ index: number; image: MapImagePlan }> {
  return plan.images.flatMap((image, index) => (image.maps.length > 0 ? [{ index, image }] : []));
}

/** R5: every map the plan will generate, in reading order. */
export function listPlannedMaps(plan: GenerationPlan): PlanMap[] {
  return inReadingOrder(plan.images.flatMap((image) => image.maps));
}
