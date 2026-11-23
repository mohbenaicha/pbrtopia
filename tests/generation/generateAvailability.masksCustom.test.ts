import { describe, expect, it } from 'vitest';
import { findKnownModel } from '../../src/generation/catalog/knownModels';
import { describeGenerateAvailability } from '../../src/generation/generateAvailability';
import { createGenerateStore } from '../../src/generation/generateStore';
import { NO_DESCRIBE_MODEL } from '../../src/generation/masks/describeMaskRunProblem';

const known = (provider: 'gemini' | 'openai', id: string) => {
  const entry = findKnownModel(provider, id);
  if (entry === null) throw new Error(`${id} is not in the table`);
  return entry;
};
const settings = { provider: 'gemini' as const, modelId: 'gemini-nano-banana-2.1', resolutionKey: '1K' as const, quality: null };

// Metal-Roughness chosen, Custom on, Gemini image model and key.
function customMaskStore() {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  s.setCatalog({ gemini: [known('gemini', 'gemini-nano-banana-2.1'), known('gemini', 'gemini-3.8-flash')], openai: [], openrouter: [] });
  s.setHasKey('gemini', true);
  s.setSceneState({ hasModel: true, hasUvs: true, albedoInForce: { kind: 'picture', id: 'a' }, sourceIsSquare: true });
  s.selectModel('gemini', 'gemini-nano-banana-2.1');
  s.setChannel('metal-rough');
  s.setMode('custom');
  return store;
}

describe('describeGenerateAvailability: Metal-Roughness in Custom (mask-generation R18)', () => {
  it('mask-generation R18 with no plan confirmed the reason is "Set up the custom generation first."', () => {
    expect(describeGenerateAvailability(customMaskStore().getState())).toMatchObject({ enabled: false, reason: 'Set up the custom generation first.' });
  });

  it('mask-generation R18 an empty plan says "Assign at least one camera to an image."', () => {
    const store = customMaskStore();
    store.getState().confirmCustomPlan({ sheets: [{ cameras: [], settings }], aux: null });
    expect(describeGenerateAvailability(store.getState()).reason).toBe('Assign at least one camera to an image.');
  });

  it('mask-generation R18 a valid plan is enabled and names its image count, the aux sheet not counted', () => {
    const store = customMaskStore();
    store.getState().confirmCustomPlan({ sheets: [{ cameras: [0], settings }, { cameras: [1, 2], settings }], aux: { settings } });
    expect(describeGenerateAvailability(store.getState())).toEqual({ action: 'generate', enabled: true, reason: null, imageCount: 2 });
  });

  it('mask-generation R18 the aux sheet of the stored plan is not judged: a gone aux model does not block', () => {
    const store = customMaskStore();
    store.getState().confirmCustomPlan({ sheets: [{ cameras: [0], settings }], aux: { settings: { ...settings, modelId: 'gone-model' } } });
    expect(describeGenerateAvailability(store.getState()).enabled).toBe(true);
  });

  it('mask-generation R18 a sheet whose model is gone is unavailable and says which image', () => {
    const store = customMaskStore();
    store.getState().confirmCustomPlan({ sheets: [{ cameras: [0], settings }, { cameras: [1], settings: { ...settings, modelId: 'gone-model' } }], aux: null });
    expect(describeGenerateAvailability(store.getState()).reason).toMatch(/^Image 2: .*no longer available/);
  });

  it('mask-generation R18 every sheet is a lead: a model that takes one reference image is accepted on the second sheet', () => {
    const store = customMaskStore();
    const model = known('gemini', 'gemini-nano-banana-2.1');
    store.getState().setCatalog({ gemini: [{ ...model, maxReferenceImages: 1 }, known('gemini', 'gemini-3.8-flash')], openai: [], openrouter: [] });
    store.getState().confirmCustomPlan({ sheets: [{ cameras: [0], settings }, { cameras: [1], settings }], aux: null });
    expect(describeGenerateAvailability(store.getState()).enabled).toBe(true);
  });

  it('mask-generation R18 without a describe model the reason is the describe-model one, before the plan reasons', () => {
    const store = customMaskStore();
    store.getState().setCatalog({ gemini: [known('gemini', 'gemini-nano-banana-2.1')], openai: [], openrouter: [] });
    expect(describeGenerateAvailability(store.getState()).reason).toBe(NO_DESCRIBE_MODEL);
  });

  it('mask-generation R18 a run in progress disables it', () => {
    const store = customMaskStore();
    store.getState().confirmCustomPlan({ sheets: [{ cameras: [0], settings }], aux: null });
    store.getState().beginRun();
    expect(describeGenerateAvailability(store.getState())).toMatchObject({ enabled: false, reason: 'A request is already running.' });
  });

  it('mask-generation R18 the panel\'s own model does not matter in Custom (Standard keeps judging it)', () => {
    const store = customMaskStore();
    store.getState().confirmCustomPlan({ sheets: [{ cameras: [0], settings }], aux: null });
    store.getState().setHasKey('gemini', true);
    store.getState().selectModel('gemini', 'gemini-3.8-flash'); // a text model: invalid as the image model of Standard
    expect(describeGenerateAvailability(store.getState()).enabled).toBe(true);
  });
});
