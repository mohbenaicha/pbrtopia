import type { ModelInfo, ModelOptions } from './modelTypes';

// R4, R5: what the panel offers for the selected model. A model that is not in the shipped table, or that is not an image model,
// offers nothing; sizes larger than the GPU's maxTextureSize are left out because the atlas capture refuses them.
export function optionsForModel(info: ModelInfo, maxTextureSize: number): ModelOptions {
  if (!info.verified || info.role !== 'image') return { resolutions: [], qualityLevels: [] };
  return {
    resolutions: info.resolutions.filter((option) => option.sizePx <= maxTextureSize).map((option) => ({ ...option })),
    qualityLevels: [...info.qualityLevels],
  };
}

// R5: the level to use for this model: the wanted one when the model offers it, otherwise the model's default (a model change, or an
// unknown level read from a saved project). Never folds one level into another. Null when the model has no levels.
export function chooseQualityLevel(info: ModelInfo, wanted: string): string | null {
  if (!info.verified || info.role !== 'image' || info.qualityLevels.length === 0) return null;
  if (info.qualityLevels.includes(wanted)) return wanted;
  return info.defaultQuality ?? null;
}
