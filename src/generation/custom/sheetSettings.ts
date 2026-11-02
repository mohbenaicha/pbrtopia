import { chooseQualityLevel, optionsForModel } from '../catalog/optionsForModel';
import type { ProviderModelRecord } from '../catalog/modelTypes';
import type { SheetSettings } from './planTypes';

// Custom R5: the settings of a sheet after its model changed. The resolution and the quality stay when the new model offers them (generate R16, R21),
// otherwise the resolution becomes the model's smallest and the quality its default (null when it has none).
export function retargetSettings(previous: SheetSettings, model: ProviderModelRecord, maxTextureSize: number): SheetSettings {
  const { resolutions } = optionsForModel(model, maxTextureSize);
  const smallest = [...resolutions].sort((a, b) => a.sizePx - b.sizePx)[0];
  const resolutionKey = resolutions.some((option) => option.key === previous.resolutionKey) ? previous.resolutionKey : (smallest?.key ?? previous.resolutionKey);
  return { provider: model.provider, modelId: model.id, resolutionKey, quality: chooseQualityLevel(model, previous.quality ?? '') };
}
