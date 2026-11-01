import type { Provider } from '../keys';
import type { AtlasRender } from './atlasRender';
import { listAtlasSizes } from './catalog/atlasSizes';
import { pickEnhancerModel } from './generateAvailability';
import { findCatalogModel, type EnhancerChoice, type GenerateState } from './generateStore';
import { buildEnhancerText } from './prompts/buildEnhancerText';
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
}

export const buildEnhancerKey = (run: EnhancerRun): EnhancerKey => ({
  provider: run.enhancer.provider,
  modelId: run.enhancer.modelId,
  level: run.enhancerLevel,
  text: buildEnhancerText(recipeForChannel(run.channel, run.atlasRender), run.prompt),
  atlasSizePx: run.atlasSizePx,
  atlasRender: run.atlasRender,
  tileBorder: run.tileBorder,
});

/** R41: the key a run would have with the panel's fields now; null when the enhancer or the atlas size cannot be found (the panel would refuse to run). */
export function buildPanelEnhancerKey(state: GenerateState): EnhancerKey | null {
  const enhancer = pickEnhancerModel(state);
  const atlas = listAtlasSizes(state.maxTextureSize).find((option) => option.key === state.atlasKey);
  if (enhancer === null || atlas === undefined) return null;
  const enhancerLevel = findCatalogModel(state.catalog, enhancer.provider, enhancer.modelId)?.enhancerLevel ?? null;
  return buildEnhancerKey({ enhancer, enhancerLevel, channel: state.channel, prompt: state.prompt, atlasSizePx: atlas.sizePx, atlasRender: state.atlasRender, tileBorder: state.tileBorder });
}

export const isSameEnhancerKey = (a: EnhancerKey, b: EnhancerKey): boolean =>
  a.provider === b.provider && a.modelId === b.modelId && a.level === b.level && a.text === b.text && a.atlasSizePx === b.atlasSizePx && a.atlasRender === b.atlasRender && a.tileBorder === b.tileBorder;
