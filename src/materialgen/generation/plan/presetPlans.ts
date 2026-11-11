import type { Provider } from '@shared/keys';
import { KNOWN_MODELS, type ProviderModelRecord } from '@shared/generation';
import { buildCardSettings } from './modelMinimums';
import { CUSTOM_PRESET_ID, type GenerationPlan, type MapImagePlan, type SavedSetup, type SheetSettings, type SingleMapChoice } from './planTypes';

export type ModelCatalog = Record<Provider, ProviderModelRecord[]>;

/** Generation R3: "Gemini" and "GPT Image" are the provider's default model for materials; the only model ids the app names (R26). */
const PRESET_MODEL_IDS: Record<Provider, string> = { gemini: 'gemini-nano-banana-2.1', openai: 'gpt-image-2.5-sunburst' };

type PresetRow = readonly [albedo: Provider, normal: Provider, height: Provider, decomposition: Provider];

/** R2: the three Full material presets, one map per image, decomposition card included. */
const PRESET_ROWS: Readonly<Record<string, { label: string; hint: string; row: PresetRow }>> = {
  'preset-1': { label: 'Full material: Gemini', hint: 'Gemini makes every map: Albedo, Normal, Height and Metal-Roughness.', row: ['gemini', 'gemini', 'gemini', 'gemini'] },
  'preset-2': { label: 'Full material: GPT Image', hint: 'GPT Image makes every map: Albedo, Normal, Height and Metal-Roughness.', row: ['openai', 'openai', 'openai', 'openai'] },
  'preset-3': { label: 'Full material: Gemini + GPT Image', hint: 'Gemini makes Albedo; GPT Image makes Normal, Height and Metal-Roughness.', row: ['gemini', 'openai', 'openai', 'openai'] },
};

/** R2: the select value of the Single map entry. */
export const SINGLE_MAP_ID = 'single-map';
const SINGLE_MAP_LABEL = 'Single map';
const SINGLE_MAP_HINT = 'Makes one map (pick it with the tabs below). Normal, Height and Metal-Roughness use the current Albedo.';

export const PRESET_IDS: readonly string[] = [...Object.keys(PRESET_ROWS), SINGLE_MAP_ID];

export const describePreset = (presetId: string): string => (presetId === SINGLE_MAP_ID ? SINGLE_MAP_LABEL : (PRESET_ROWS[presetId]?.label ?? 'Custom'));

/** The tooltip of a preset's row: what it builds. */
export const describePresetHint = (presetId: string): string | undefined => (presetId === SINGLE_MAP_ID ? SINGLE_MAP_HINT : PRESET_ROWS[presetId]?.hint);

/** R3: the model a preset names, from the catalog (providers with a key), else the shipped table so the settings are sensible before a key exists; null when neither lists it. */
function resolvePresetModel(provider: Provider, catalog: ModelCatalog): ProviderModelRecord | null {
  const id = PRESET_MODEL_IDS[provider];
  return catalog[provider].find((model) => model.id === id) ?? KNOWN_MODELS.find((model) => model.provider === provider && model.id === id) ?? null;
}

function presetSettings(provider: Provider, catalog: ModelCatalog, maxTextureSize: number): SheetSettings {
  const model = resolvePresetModel(provider, catalog);
  // R3: a model the catalog does not list is still applied, so its card shows the problem (R19).
  return model === null ? { provider, modelId: PRESET_MODEL_IDS[provider], resolutionKey: '1K', quality: null } : buildCardSettings(model, maxTextureSize, 1);
}

/** R2, R3: the plan of a preset, or null for an id that is not a preset. */
export function buildPresetPlan(presetId: string, catalog: ModelCatalog, maxTextureSize: number): GenerationPlan | null {
  if (presetId === SINGLE_MAP_ID) return { images: [{ maps: ['albedo'], settings: presetSettings('openai', catalog, maxTextureSize) }], decomposition: null };
  const entry = PRESET_ROWS[presetId];
  if (entry === undefined) return null;
  const [albedo, normal, height, decomposition] = entry.row;
  const maps: Array<[MapImagePlan['maps'][number], Provider]> = [['albedo', albedo], ['normal', normal], ['height', height]];
  return {
    images: maps.map(([map, provider]) => ({ maps: [map], settings: presetSettings(provider, catalog, maxTextureSize) })),
    decomposition: presetSettings(decomposition, catalog, maxTextureSize),
  };
}

const sameSettings = (a: SheetSettings, b: SheetSettings): boolean =>
  a.provider === b.provider && a.modelId === b.modelId && a.resolutionKey === b.resolutionKey && a.quality === b.quality;

/** R4, R20: whether two plans are the same, card by card (an empty card counts). */
export function isSamePlan(a: GenerationPlan, b: GenerationPlan): boolean {
  if (a.images.length !== b.images.length) return false;
  const imagesMatch = a.images.every((image, index) => {
    const other = b.images[index]!;
    return image.maps.length === other.maps.length && image.maps.every((map, at) => map === other.maps[at]) && sameSettings(image.settings, other.settings);
  });
  if (!imagesMatch) return false;
  if (a.decomposition === null || b.decomposition === null) return a.decomposition === b.decomposition;
  return sameSettings(a.decomposition, b.decomposition);
}

/** R2, R4: what the plan generates when it holds exactly one thing (one map image with one map and no decomposition card, or the decomposition card alone); else null. */
export function readSingleMap(plan: GenerationPlan): SingleMapChoice | null {
  if (plan.images.length === 1 && plan.images[0]!.maps.length === 1 && plan.decomposition === null) return plan.images[0]!.maps[0]!;
  return plan.images.length === 0 && plan.decomposition !== null ? 'metal-roughness' : null;
}

/** R2, R16: the Single map tabs. The one model, resolution and quality carry over to the map the tab picks. */
export function setSingleMap(plan: GenerationPlan, choice: SingleMapChoice): GenerationPlan {
  const settings = plan.images[0]?.settings ?? plan.decomposition;
  if (settings === null) return plan;
  return choice === 'metal-roughness' ? { images: [], decomposition: { ...settings } } : { images: [{ maps: [choice], settings: { ...settings } }], decomposition: null };
}

export const savedSetupValue = (name: string): string => `saved:${name}`;

/** R1, R4: the select value for a plan: the preset it equals, else the saved setup it equals, else Custom. */
export function detectPlanEntry(plan: GenerationPlan, saved: readonly SavedSetup[], catalog: ModelCatalog, maxTextureSize: number): string {
  for (const presetId of PRESET_IDS) {
    const preset = buildPresetPlan(presetId, catalog, maxTextureSize);
    if (preset !== null && presetId !== SINGLE_MAP_ID && isSamePlan(plan, preset)) return presetId;
  }
  if (readSingleMap(plan) !== null) return SINGLE_MAP_ID;
  const match = saved.find((setup) => isSamePlan(plan, setup.plan));
  return match === undefined ? CUSTOM_PRESET_ID : savedSetupValue(match.name);
}
