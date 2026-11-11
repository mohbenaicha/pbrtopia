import { optionsForModel, type ProviderModelRecord, type ResolutionKey, type ResolutionOption } from '@shared/generation';
import { chooseLayout } from '../layout/chooseLayout';
import type { SheetSettings } from './planTypes';

/**
 * Generation R27, architecture note: the lowest settings the material app offers per model family, kept as data. A family hides the qualities it lists and names the
 * quality a new card starts on. A model in no family keeps the catalog's own list and default.
 */
interface FamilyMinimum {
  name: string;
  matches(model: ProviderModelRecord): boolean;
  hiddenQualities: readonly string[];
  startQuality: string;
}

const FAMILY_MINIMUMS: readonly FamilyMinimum[] = [
  { name: 'Gemini image', matches: (model) => model.provider === 'gemini', hiddenQualities: [], startQuality: 'minimal' },
  { name: 'GPT Image 2.5 and 2.6', matches: (model) => /^gpt-image-2\.[56]-/.test(model.id), hiddenQualities: ['low'], startQuality: 'medium' },
];

const familyOf = (model: ProviderModelRecord): FamilyMinimum | undefined => FAMILY_MINIMUMS.find((family) => family.matches(model));

export interface CardOptions {
  resolutions: ResolutionOption[]; // smallest first
  qualityLevels: string[];
  startQuality: string | null;
}

/** R26, R27, R29: what a card of this model offers: the catalog's lists (levels it marks unusable are already out), minus the family's hidden levels. */
export function listCardOptions(model: ProviderModelRecord, maxTextureSize: number): CardOptions {
  const { resolutions, qualityLevels } = optionsForModel(model, maxTextureSize);
  const family = familyOf(model);
  const offered = qualityLevels.filter((level) => !(family?.hiddenQualities.includes(level) ?? false));
  const preferred = family !== undefined && offered.includes(family.startQuality) ? family.startQuality : undefined;
  return {
    resolutions: [...resolutions].sort((a, b) => a.sizePx - b.sizePx),
    qualityLevels: offered,
    startQuality: preferred ?? (model.defaultQuality !== undefined && offered.includes(model.defaultQuality) ? model.defaultQuality : (offered[0] ?? null)),
  };
}

/** R28: a new card or a preset takes the smallest resolution whose layout for `mapCount` maps is valid (the smallest offered when none is) and the start quality. */
export function buildCardSettings(model: ProviderModelRecord, maxTextureSize: number, mapCount: number): SheetSettings {
  const { resolutions, startQuality } = listCardOptions(model, maxTextureSize);
  const valid = resolutions.find((option) => chooseLayout(model.canvases, option.key, mapCount).ok);
  const key: ResolutionKey = (valid ?? resolutions[0])?.key ?? '1K';
  return { provider: model.provider, modelId: model.id, resolutionKey: key, quality: startQuality };
}

/** R16: the settings of a card after its model changed: resolution and quality stay when the new model offers them, else the smallest resolution and the start quality. */
export function retargetCardSettings(previous: SheetSettings, model: ProviderModelRecord, maxTextureSize: number, mapCount: number): SheetSettings {
  const { resolutions, qualityLevels, startQuality } = listCardOptions(model, maxTextureSize);
  const fresh = buildCardSettings(model, maxTextureSize, mapCount);
  const keepsResolution = resolutions.some((option) => option.key === previous.resolutionKey);
  const keepsQuality = previous.quality !== null && qualityLevels.includes(previous.quality);
  return {
    provider: model.provider,
    modelId: model.id,
    resolutionKey: keepsResolution ? previous.resolutionKey : fresh.resolutionKey,
    quality: keepsQuality ? previous.quality : startQuality,
  };
}
