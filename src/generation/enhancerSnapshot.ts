import type { Provider } from '../keys';
import type { AtlasRender } from './atlasRender';
import { listAtlasSizes } from './catalog/atlasSizes';
import { pickEnhancerModel } from './generateAvailability';
import { findCatalogModel, type EnhancerChoice, type GenerateState } from './generateStore';
import { buildEnhancerText, type EnhancerScope } from './prompts/buildEnhancerText';
import { recipeForChannel, type RecipeChannel } from './prompts/mapRecipes';

// R41: everything that decides what the enhancer is asked, short of the picture itself (which a run compares by fingerprint).
export interface EnhancerKey {
  provider: Provider;
  modelId: string;
  level: string | null;
  text: string; // the built enhancer text: the recipe's focus and the user's prompt
  atlasSizePx: number;
  atlasRender: AtlasRender;
  tileBorder: boolean;
  overviewCameras: number[]; // custom R15: the core cameras the overview shows, in core order; empty in Standard (its picture is the atlas)
}

// R41: the last enhancer call: what it was asked, the picture it saw, and what it answered.
export interface EnhancerSnapshot {
  key: EnhancerKey;
  atlasFingerprint: string; // of the atlas as sent to the enhancer, after the scaling of R29
  enhancedPrompt: string;
}

interface EnhancerRun {
  enhancer: EnhancerChoice;
  enhancerLevel: string | null;
  channel: RecipeChannel;
  prompt: string;
  atlasSizePx: number;
  atlasRender: AtlasRender;
  tileBorder: boolean;
  scope?: EnhancerScope; // 'object' in Custom (custom R15); it shows in the built text, so no field of its own in the key
  overviewCameras?: number[]; // Custom: the assigned core cameras the overview packs; they decide its picture
}

const sortedUnique = (cameras: readonly number[]): number[] => [...new Set(cameras)].sort((a, b) => a - b);

// The overview picture the enhancer sees in Custom (custom R15).
export const CUSTOM_OVERVIEW_SIZE_PX = 1024;

export const buildEnhancerKey = (run: EnhancerRun): EnhancerKey => ({
  provider: run.enhancer.provider,
  modelId: run.enhancer.modelId,
  level: run.enhancerLevel,
  text: buildEnhancerText(recipeForChannel(run.channel, run.atlasRender), run.prompt, run.scope),
  atlasSizePx: run.atlasSizePx,
  atlasRender: run.atlasRender,
  tileBorder: run.tileBorder,
  overviewCameras: sortedUnique(run.overviewCameras ?? []),
});

/** R41: the key a run would have with the panel's fields now; null when the enhancer or the atlas size cannot be found (the panel would refuse to run). */
export function buildPanelEnhancerKey(state: GenerateState): EnhancerKey | null {
  const enhancer = pickEnhancerModel(state);
  const atlas = listAtlasSizes(state.maxTextureSize).find((option) => option.key === state.atlasKey);
  if (enhancer === null) return null;
  const enhancerLevel = findCatalogModel(state.catalog, enhancer.provider, enhancer.modelId)?.enhancerLevel ?? null;
  const common = { enhancer, enhancerLevel, channel: state.channel, prompt: state.prompt, atlasRender: state.atlasRender, tileBorder: state.tileBorder };
  if (state.mode === 'custom') return buildEnhancerKey({ ...common, atlasSizePx: CUSTOM_OVERVIEW_SIZE_PX, scope: 'object', overviewCameras: (state.customPlan?.sheets ?? []).flatMap((sheet) => sheet.cameras) }); // custom R15: the Atlas size is not used; the plan's cameras are the picture
  return atlas === undefined ? null : buildEnhancerKey({ ...common, atlasSizePx: atlas.sizePx });
}

export const isSameEnhancerKey = (a: EnhancerKey, b: EnhancerKey): boolean =>
  a.provider === b.provider && a.modelId === b.modelId && a.level === b.level && a.text === b.text && a.atlasSizePx === b.atlasSizePx && a.atlasRender === b.atlasRender && a.tileBorder === b.tileBorder && a.overviewCameras.length === b.overviewCameras.length && a.overviewCameras.every((camera, index) => camera === b.overviewCameras[index]);
