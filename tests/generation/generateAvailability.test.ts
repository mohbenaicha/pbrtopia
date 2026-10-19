import { describe, expect, it } from 'vitest';
import { findKnownModel } from '../../src/generation/catalog/knownModels';
import type { ModelInfo } from '../../src/generation/catalog/modelTypes';
import { describeGenerateAvailability } from '../../src/generation/generateAvailability';
import { createGenerateStore } from '../../src/generation/generateStore';

const known = (provider: 'gemini' | 'openai', id: string): ModelInfo => {
  const entry = findKnownModel(provider, id);
  if (entry === null) throw new Error(`${id} is not in the table`);
  return entry;
};
const unverified: ModelInfo = { provider: 'openai', id: 'gpt-image-9-mystery', role: 'image', displayName: 'gpt-image-9-mystery', verified: false, resolutions: [], qualityLevels: [] };

// A store that is ready to generate with Gemini: model loaded with UVs, image model chosen, key present, enhancer from Settings.
function readyStore() {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  s.setCatalog({
    gemini: [known('gemini', 'gemini-nano-banana-2.1'), known('gemini', 'gemini-3.8-flash')],
    openai: [known('openai', 'gpt-image-2.5-sunburst'), known('openai', 'gpt-6-astra'), unverified],
  });
  s.setSceneState({ hasModel: true, hasUvs: true });
  s.setHasKey('gemini', true);
  s.selectModel('gemini', 'gemini-nano-banana-2.1');
  s.setEnhancer({ provider: 'gemini', modelId: 'gemini-3.8-flash' });
  return store;
}
const describeNow = (store: ReturnType<typeof readyStore>) => describeGenerateAvailability(store.getState());

describe('describeGenerateAvailability (R6, R15)', () => {
  it('R6 is enabled with no reason when everything is in place', () => {
    expect(describeNow(readyStore())).toEqual({ action: 'generate', enabled: true, reason: null });
  });

  it('R6 no 3D model loaded', () => {
    const store = readyStore();
    store.getState().setSceneState({ hasModel: false, hasUvs: false });
    const result = describeNow(store);
    expect(result).toMatchObject({ action: 'generate', enabled: false });
    expect(result.reason).toMatch(/3D model/);
  });

  it('R6 no image model chosen', () => {
    const store = createGenerateStore();
    store.getState().setSceneState({ hasModel: true, hasUvs: true });
    const result = describeNow(store);
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/image model/);
  });

  it('R6 an unverified model cannot be used until the table knows it', () => {
    const store = readyStore();
    store.getState().setHasKey('openai', true);
    store.getState().selectModel('openai', 'gpt-image-9-mystery');
    const result = describeNow(store);
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/not verified|unverified/i);
  });

  it('R6 no key for the image provider', () => {
    const store = readyStore();
    store.getState().setHasKey('gemini', false);
    const result = describeNow(store);
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/Gemini key|key for Gemini/i);
  });

  it('R6 no enhancer model: none chosen and the image provider has no verified text model', () => {
    const store = readyStore();
    store.getState().setEnhancer(null);
    store.getState().setCatalog({ gemini: [known('gemini', 'gemini-nano-banana-2.1')], openai: [] });
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    const result = describeNow(store);
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/enhancer/i);
  });

  it('R6 with no enhancer chosen the first verified text model of the image provider is used', () => {
    const store = readyStore();
    store.getState().setEnhancer(null);
    expect(describeNow(store)).toEqual({ action: 'generate', enabled: true, reason: null });
  });

  it('R6 no key for the enhancer provider', () => {
    const store = readyStore();
    store.getState().setEnhancer({ provider: 'openai', modelId: 'gpt-6-astra' });
    const result = describeNow(store);
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/OpenAI/);
  });

  it('R6 a request in flight', () => {
    const store = readyStore();
    store.getState().beginRun();
    const result = describeNow(store);
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/in progress|already running/i);
  });

  it('R6 every reason is a distinct sentence', () => {
    const reasons = new Set<string | null>();
    const noModel = readyStore();
    noModel.getState().setSceneState({ hasModel: false, hasUvs: false });
    reasons.add(describeNow(noModel).reason);
    const noImage = createGenerateStore();
    noImage.getState().setSceneState({ hasModel: true, hasUvs: true });
    reasons.add(describeGenerateAvailability(noImage.getState()).reason);
    const noKey = readyStore();
    noKey.getState().setHasKey('gemini', false);
    reasons.add(describeNow(noKey).reason);
    const noEnhancerKey = readyStore();
    noEnhancerKey.getState().setEnhancer({ provider: 'openai', modelId: 'gpt-6-astra' });
    reasons.add(describeNow(noEnhancerKey).reason);
    const busy = readyStore();
    busy.getState().beginRun();
    reasons.add(describeNow(busy).reason);
    expect(reasons.size).toBe(5);
    expect(reasons.has(null)).toBe(false);
  });

  it('R6 the first failing check wins: no 3D model is reported before a missing key', () => {
    const store = readyStore();
    store.getState().setHasKey('gemini', false);
    store.getState().setSceneState({ hasModel: false, hasUvs: false });
    expect(describeNow(store).reason).toMatch(/3D model/);
  });

  it('R15 a loaded model with no UVs gives Generate UV, enabled even with no key or image model', () => {
    const store = createGenerateStore();
    store.getState().setSceneState({ hasModel: true, hasUvs: false });
    expect(describeGenerateAvailability(store.getState())).toEqual({ action: 'generate-uv', enabled: true, reason: null });
  });

  it('R15 Generate UV is disabled only while a request is in flight', () => {
    const store = createGenerateStore();
    store.getState().setSceneState({ hasModel: true, hasUvs: false });
    store.getState().beginRun();
    const result = describeGenerateAvailability(store.getState());
    expect(result).toMatchObject({ action: 'generate-uv', enabled: false });
    expect(result.reason).not.toBeNull();
  });
});
