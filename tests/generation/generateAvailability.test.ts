import { describe, expect, it } from 'vitest';
import { findKnownModel } from '../../src/generation/catalog/knownModels';
import type { ProviderModelRecord } from '../../src/generation/catalog/modelTypes';
import { describeGenerateAvailability, pickEnhancerModel } from '../../src/generation/generateAvailability';
import { createGenerateStore } from '../../src/generation/generateStore';

const known = (provider: 'gemini' | 'openai', id: string): ProviderModelRecord => {
  const entry = findKnownModel(provider, id);
  if (entry === null) throw new Error(`${id} is not in the table`);
  return entry;
};
const unverified: ProviderModelRecord = { provider: 'openai', id: 'gpt-image-9-mystery', role: 'image', displayName: 'gpt-image-9-mystery', verified: false, resolutions: [], qualityLevels: [] };

// A store that is ready to generate with Gemini: model loaded with UVs, image model chosen, key present, enhancer from Settings.
function readyStore() {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  s.setCatalog({
    gemini: [known('gemini', 'gemini-nano-banana-2.1'), known('gemini', 'gemini-3.8-flash')],
    openai: [known('openai', 'gpt-image-2.5-sunburst'), known('openai', 'gpt-6-luna'), unverified],
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

  it('R20 a chosen model that is missing from the model list says so, and Generate stays disabled until it is back', () => {
    const store = readyStore();
    store.getState().setCatalog({ gemini: [known('gemini', 'gemini-3.8-flash')], openai: [] });
    const result = describeNow(store);
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/no longer available/i);
    store.getState().setCatalog({ gemini: [known('gemini', 'gemini-nano-banana-2.1'), known('gemini', 'gemini-3.8-flash')], openai: [] });
    expect(describeNow(store)).toEqual({ action: 'generate', enabled: true, reason: null });
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
    expect(pickEnhancerModel(store.getState())).toEqual({ provider: 'gemini', modelId: 'gemini-3.8-flash' });
  });

  it('R8 with no enhancer chosen the default is GPT-6 Luna with an OpenAI key, else Gemini 3.8 Flash, else none', () => {
    const store = readyStore();
    const { catalog } = store.getState();
    expect(pickEnhancerModel({ enhancer: null, provider: null, catalog, hasKey: { gemini: true, openai: true } })).toEqual({ provider: 'openai', modelId: 'gpt-6-luna' });
    expect(pickEnhancerModel({ enhancer: null, provider: null, catalog, hasKey: { gemini: true, openai: false } })).toEqual({ provider: 'gemini', modelId: 'gemini-3.8-flash' });
    expect(pickEnhancerModel({ enhancer: null, provider: null, catalog, hasKey: { gemini: false, openai: false } })).toBeNull();
  });

  it('R6 a chosen enhancer wins over the fallback, and an image model is never the fallback', () => {
    const store = readyStore();
    store.getState().setEnhancer({ provider: 'openai', modelId: 'gpt-6-luna' });
    expect(pickEnhancerModel(store.getState())).toEqual({ provider: 'openai', modelId: 'gpt-6-luna' });
    store.getState().setEnhancer(null);
    store.getState().setCatalog({ gemini: [known('gemini', 'gemini-nano-banana-2.1')], openai: [] });
    expect(pickEnhancerModel(store.getState())).toBeNull();
  });

  it('R6 no key for the enhancer provider', () => {
    const store = readyStore();
    store.getState().setEnhancer({ provider: 'openai', modelId: 'gpt-6-luna' });
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
    noEnhancerKey.getState().setEnhancer({ provider: 'openai', modelId: 'gpt-6-luna' });
    reasons.add(describeNow(noEnhancerKey).reason);
    const busy = readyStore();
    busy.getState().beginRun();
    reasons.add(describeNow(busy).reason);
    const unverifiedModel = readyStore();
    unverifiedModel.getState().setHasKey('openai', true);
    unverifiedModel.getState().selectModel('openai', 'gpt-image-9-mystery');
    reasons.add(describeNow(unverifiedModel).reason);
    const noEnhancer = readyStore();
    noEnhancer.getState().setEnhancer(null);
    noEnhancer.getState().setCatalog({ gemini: [known('gemini', 'gemini-nano-banana-2.1')], openai: [] });
    noEnhancer.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    reasons.add(describeNow(noEnhancer).reason);
    expect(reasons.size).toBe(7);
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

  it('R17 Generate UV is disabled with its own reason while the unwrap runs, and enabled again after a failure', () => {
    const store = createGenerateStore();
    store.getState().setSceneState({ hasModel: true, hasUvs: false });
    store.getState().beginUnwrap();
    expect(describeGenerateAvailability(store.getState())).toEqual({ action: 'generate-uv', enabled: false, reason: 'UVs are being generated.' });
    store.getState().failUnwrap({ category: 'engine', retryable: false, message: 'x' });
    expect(describeGenerateAvailability(store.getState())).toEqual({ action: 'generate-uv', enabled: true, reason: null });
  });

  it.each([
    ['readOnly', { readOnly: true }, 'This project is open in another tab.'],
    ['setOpen', { setOpen: true }, 'Exit projection mode first.'],
    ['setBusy', { setBusy: true }, 'Wait for the current task to finish.'],
  ] as const)('R18 %s disables the button with its reason, for Generate and for Generate UV', (_name, flag, reason) => {
    const store = createGenerateStore();
    store.getState().setSceneState({ hasModel: true, hasUvs: true, ...flag });
    expect(describeGenerateAvailability(store.getState())).toEqual({ action: 'generate', enabled: false, reason });
    store.getState().setSceneState({ hasModel: true, hasUvs: false, ...flag });
    expect(describeGenerateAvailability(store.getState())).toEqual({ action: 'generate-uv', enabled: false, reason });
  });

  it('R18 the reasons come right after "Load a 3D model first." and before the key checks, in this order: read-only, set open, busy', () => {
    const store = createGenerateStore();
    store.getState().setSceneState({ hasModel: false, hasUvs: true, readOnly: true });
    expect(describeGenerateAvailability(store.getState()).reason).toBe('Load a 3D model first.');
    store.getState().setSceneState({ hasModel: true, hasUvs: true, readOnly: true, setOpen: true, setBusy: true });
    expect(describeGenerateAvailability(store.getState()).reason).toBe('This project is open in another tab.');
    store.getState().setSceneState({ hasModel: true, hasUvs: true, setOpen: true, setBusy: true });
    expect(describeGenerateAvailability(store.getState()).reason).toBe('Exit projection mode first.');
    store.getState().setSceneState({ hasModel: true, hasUvs: true });
    expect(describeGenerateAvailability(store.getState()).reason).not.toBe('Wait for the current task to finish.');
  });

  it('R17 Generate stays disabled while the unwrap is still running after it has set hasUvs (the viewport still shows the old model)', () => {
    const store = createGenerateStore();
    store.getState().setSceneState({ hasModel: true, hasUvs: false });
    store.getState().beginUnwrap();
    store.getState().setSceneState({ hasModel: true, hasUvs: true });
    expect(describeGenerateAvailability(store.getState())).toEqual({ action: 'generate', enabled: false, reason: 'UVs are being generated.' });
  });

  it('R17 once the unwrap has given the model UVs the button is Generate again', () => {
    const store = createGenerateStore();
    store.getState().setSceneState({ hasModel: true, hasUvs: false });
    store.getState().beginUnwrap();
    store.getState().setSceneState({ hasModel: true, hasUvs: true });
    store.getState().clearUnwrap();
    expect(describeGenerateAvailability(store.getState()).action).toBe('generate');
  });
});

describe('describeGenerateAvailability: custom plan models (custom R7, R13)', () => {
  const sheet = (cameras: number[], modelId = 'gemini-nano-banana-2.1') => ({ cameras, settings: { provider: 'gemini' as const, modelId, resolutionKey: '1K' as const, quality: null } });
  const picture = (id: string) => ({ id, name: id, width: 8, height: 8, blob: new Blob([id]) });
  const customStore = (limit: number | undefined, catalogEdit?: (model: ProviderModelRecord) => ProviderModelRecord) => {
    const store = readyStore();
    const base = known('gemini', 'gemini-nano-banana-2.1');
    const withLimit = limit === undefined ? base : { ...base, maxReferenceImages: limit };
    const nano = catalogEdit === undefined ? withLimit : catalogEdit(withLimit);
    store.getState().setCatalog({ gemini: [nano, known('gemini', 'gemini-3.8-flash')], openai: [] });
    store.getState().setMode('custom');
    store.getState().confirmCustomPlan({ sheets: [sheet([0, 1]), sheet([2, 3])], aux: null });
    return store;
  };

  it('custom R7 a sheet whose model has no canvas at its resolution disables Generate and says so with the image number', () => {
    const store = customStore(undefined, (model) => {
      const without = { ...model };
      delete without.canvases;
      return without;
    });
    expect(describeNow(store)).toMatchObject({ enabled: false, reason: 'Image 1: This image model offers no image size for custom generation. Choose another.' });
  });

  it('custom R13 references that fit the lead model are fine; one more than fits disables Generate with the limit', () => {
    const store = customStore(undefined);
    store.getState().addReferences([picture('a'), picture('b')]);
    store.getState().setCatalog({ gemini: [{ ...known('gemini', 'gemini-nano-banana-2.1'), maxReferenceImages: 3 }, known('gemini', 'gemini-3.8-flash')], openai: [] });
    expect(describeNow(store)).toMatchObject({ enabled: true });
    const crowded = customStore(undefined);
    crowded.getState().addReferences([picture('a'), picture('b'), picture('c')]);
    crowded.getState().setCatalog({ gemini: [{ ...known('gemini', 'gemini-nano-banana-2.1'), maxReferenceImages: 3 }, known('gemini', 'gemini-3.8-flash')], openai: [] });
    expect(describeNow(crowded)).toMatchObject({ enabled: false, reason: "Too many reference images for image 1's model (2 at most)." });
  });

  it('custom R13 a follower whose model takes fewer than two images is refused with its image number', () => {
    const store = customStore(undefined);
    const nano = { ...known('gemini', 'gemini-nano-banana-2.1'), maxReferenceImages: 1 };
    store.getState().setCatalog({ gemini: [nano, known('gemini', 'gemini-3.8-flash')], openai: [] });
    expect(describeNow(store).reason).toBe('Image 2: This image model takes too few reference images to follow the first image.');
  });

  it('custom R13 Add images in Custom is limited by the lead sheet model, not the Standard one', () => {
    const store = customStore(3);
    store.getState().setCatalog({ gemini: [{ ...known('gemini', 'gemini-nano-banana-2.1'), maxReferenceImages: 3 }, known('gemini', 'gemini-3-pro-image'), known('gemini', 'gemini-3.8-flash')], openai: [] });
    store.getState().selectModel('gemini', 'gemini-3-pro-image');
    const outcome = store.getState().addReferences([picture('a'), picture('b'), picture('c')]);
    expect(outcome).toEqual({ added: 2, refused: 1 });
  });
});
