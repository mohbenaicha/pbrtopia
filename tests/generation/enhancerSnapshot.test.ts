import { describe, expect, it } from 'vitest';
import { buildEnhancerKey, buildPanelEnhancerKey, isSameEnhancerKey } from '../../src/generation/enhancerSnapshot';
import { findKnownModel } from '../../src/generation/catalog/knownModels';
import type { ProviderModelRecord } from '../../src/generation/catalog/modelTypes';
import { createGenerateStore } from '../../src/generation/generateStore';
import { buildEnhancerText } from '../../src/generation/prompts/buildEnhancerText';
import { recipeForChannel } from '../../src/generation/prompts/mapRecipes';

const known = (provider: 'gemini' | 'openai', id: string): ProviderModelRecord => {
  const entry = findKnownModel(provider, id);
  if (entry === null) throw new Error(`${id} is not in the table`);
  return entry;
};

const run = (patch: Partial<Parameters<typeof buildEnhancerKey>[0]> = {}): Parameters<typeof buildEnhancerKey>[0] => ({
  enhancer: { provider: 'gemini', modelId: 'gemini-3.8-flash' },
  enhancerLevel: 'low',
  channel: 'albedo',
  prompt: 'weathered steel',
  atlasSizePx: 2048,
  atlasRender: 'grey',
  tileBorder: true,
  ...patch,
});

function panel() {
  const store = createGenerateStore();
  const state = store.getState();
  state.setMaxTextureSize(8192);
  state.setCatalog({ gemini: [known('gemini', 'gemini-nano-banana-2.1'), known('gemini', 'gemini-3.8-flash')], openai: [known('openai', 'gpt-6-luna')] });
  state.selectModel('gemini', 'gemini-nano-banana-2.1');
  state.setAtlasKey('2K');
  state.setPrompt('weathered steel');
  return store;
}

describe('enhancerSnapshot: the key of an enhancer call (R41)', () => {
  it('R41 the key holds the enhancer model, its level, the built enhancer text, the atlas size, the render and the border', () => {
    expect(buildEnhancerKey(run())).toEqual({
      provider: 'gemini',
      modelId: 'gemini-3.8-flash',
      level: 'low',
      text: buildEnhancerText(recipeForChannel('albedo', 'grey'), 'weathered steel'),
      atlasSizePx: 2048,
      atlasRender: 'grey',
      tileBorder: true,
    });
  });

  it('R41 equal runs have equal keys', () => {
    expect(isSameEnhancerKey(buildEnhancerKey(run()), buildEnhancerKey(run()))).toBe(true);
  });

  it.each([
    ['the enhancer model', { enhancer: { provider: 'openai' as const, modelId: 'gpt-6-luna' } }],
    ['the enhancer level', { enhancerLevel: null }],
    ['the prompt', { prompt: 'weathered steel, rusty' }],
    ['the atlas size', { atlasSizePx: 1024 }],
    ['the atlas render', { atlasRender: 'wireframe' as const }],
    ['the tile border', { tileBorder: false }],
  ])('R41 a different %s makes a different key', (_name, patch) => {
    expect(isSameEnhancerKey(buildEnhancerKey(run()), buildEnhancerKey(run(patch)))).toBe(false);
  });

  it('R41 the render counts even when its enhancer wording is the same (grey and depth)', () => {
    expect(isSameEnhancerKey(buildEnhancerKey(run()), buildEnhancerKey(run({ atlasRender: 'depth' })))).toBe(false);
  });
});

describe('enhancerSnapshot: the key of the panel (R41)', () => {
  it('R41 the panel key equals the run key for the same fields (the enhancer follows the image provider, the atlas size follows the key)', () => {
    const state = panel().getState();
    expect(buildPanelEnhancerKey(state)).toEqual(buildEnhancerKey(run({ atlasRender: state.atlasRender, tileBorder: state.tileBorder })));
  });

  it.each([
    ['the prompt', (state: ReturnType<ReturnType<typeof panel>['getState']>) => state.setPrompt('other')],
    ['the atlas render', (state: ReturnType<ReturnType<typeof panel>['getState']>) => state.setAtlasRender('depth')],
    ['the tile border', (state: ReturnType<ReturnType<typeof panel>['getState']>) => state.setTileBorder(false)],
    ['the atlas size', (state: ReturnType<ReturnType<typeof panel>['getState']>) => state.setAtlasKey('1K')],
  ])('R41 changing %s of the panel changes its key', (_name, change) => {
    const store = panel();
    const before = buildPanelEnhancerKey(store.getState())!;
    change(store.getState());
    expect(isSameEnhancerKey(before, buildPanelEnhancerKey(store.getState())!)).toBe(false);
  });

  it('R41 changing the image model or its resolution does not change the key of the panel', () => {
    const store = panel();
    const before = buildPanelEnhancerKey(store.getState())!;
    store.getState().setCatalog({ gemini: [known('gemini', 'gemini-nano-banana-2.1'), known('gemini', 'gemini-3-pro-image'), known('gemini', 'gemini-3.8-flash')], openai: [] });
    store.getState().selectModel('gemini', 'gemini-3-pro-image');
    store.getState().setResolution('2K');
    expect(isSameEnhancerKey(before, buildPanelEnhancerKey(store.getState())!)).toBe(true);
  });

  it('R41 the panel key is null without an enhancer model or without a usable atlas size', () => {
    const empty = createGenerateStore().getState();
    expect(buildPanelEnhancerKey(empty)).toBeNull();
    const noSize = panel();
    noSize.getState().setMaxTextureSize(1);
    expect(buildPanelEnhancerKey(noSize.getState())).toBeNull();
  });
});
