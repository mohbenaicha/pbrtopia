import type { Provider } from '../../keys';
import type { ProviderModelRecord, ResolutionKey } from '../catalog/modelTypes';
import type { CustomPlanRecord, SheetSettings } from './planTypes';

const PRESET_MODEL_ID = 'gpt-image-2.5-sunburst';

// Custom generation R4. Camera indices: Front 0, Right 1, Back 2, Left 3, Top 4, Bottom 5.
export type PresetName = 'default' | 'two-two-two' | 'three-images';
export const PRESET_NAMES: readonly PresetName[] = ['default', 'two-two-two', 'three-images'];

const PRESET_CAMERAS: Record<PresetName, number[][]> = {
  default: [[0], [2], [1, 3], [4, 5]],
  'two-two-two': [[0, 2], [1, 3], [4, 5]],
  'three-images': [[0, 1, 3], [2, 4, 5]],
};

// R4: the model the presets use: gpt-image-2.5-sunburst when it is listed and verified, otherwise the first verified image model of a provider with a key (Gemini first); null when there is none.
export function pickPresetModel(catalog: Record<Provider, ProviderModelRecord[]>, hasKey: Record<Provider, boolean>): ProviderModelRecord | null {
  const sunburst = catalog.openai.find((model) => model.id === PRESET_MODEL_ID && model.role === 'image' && model.verified);
  if (sunburst !== undefined) return sunburst;
  for (const provider of ['gemini', 'openai'] as const) {
    if (!hasKey[provider]) continue;
    const first = catalog[provider].find((model) => model.role === 'image' && model.verified);
    if (first !== undefined) return first;
  }
  return null;
}

// The model's smallest resolution and its lowest quality ("low" when offered, otherwise the first level, null when it has none).
export function buildPresetSettings(model: ProviderModelRecord): SheetSettings {
  const smallest = [...model.resolutions].sort((a, b) => a.sizePx - b.sizePx)[0];
  const quality = model.qualityLevels.includes('low') ? 'low' : (model.qualityLevels[0] ?? null);
  return { provider: model.provider, modelId: model.id, resolutionKey: smallest?.key ?? ('1K' satisfies ResolutionKey), quality };
}

// A preset replaces the whole plan: the same settings on every sheet, auxiliary cameras on.
export function buildPresetPlan(preset: PresetName, model: ProviderModelRecord): CustomPlanRecord {
  const settings = buildPresetSettings(model);
  return {
    sheets: PRESET_CAMERAS[preset].map((cameras) => ({ cameras: [...cameras], settings: { ...settings } })),
    aux: { settings: { ...settings } },
  };
}

// Which preset the plan still equals; any edit after a preset makes it "custom".
export function detectPreset(plan: CustomPlanRecord, model: ProviderModelRecord): PresetName | 'custom' {
  const text = JSON.stringify(plan);
  return PRESET_NAMES.find((preset) => JSON.stringify(buildPresetPlan(preset, model)) === text) ?? 'custom';
}
