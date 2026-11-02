import type { ProviderModelRecord } from './modelTypes';

// Generate R4: how many of the user's own reference images a model takes besides the one image the app always sends (the atlas, or a custom
// sheet's snapshot). Infinity when the model's limit is unknown.
export function countUserReferenceSlots(model: ProviderModelRecord | null): number {
  return model?.maxReferenceImages === undefined ? Infinity : Math.max(0, model.maxReferenceImages - 1);
}
