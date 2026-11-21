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

// A store with Metal-Roughness chosen on a model that has one albedo on every material, Gemini image model and key.
function maskStore(patch: { enhancerKey?: boolean; enhancer?: 'settings' | 'auto' } = {}) {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  s.setCatalog({ gemini: [known('gemini', 'gemini-nano-banana-2.1'), known('gemini', 'gemini-3.8-flash')], openai: [known('openai', 'gpt-6-luna')], openrouter: [] });
  s.setHasKey('gemini', true);
  s.setSceneState({ hasModel: true, hasUvs: true, albedoPictureIds: ['a', 'a'], sourceIsSquare: true });
  s.selectModel('gemini', 'gemini-nano-banana-2.1');
  if (patch.enhancer === 'settings') s.setEnhancer({ provider: 'openai', modelId: 'gpt-6-luna' });
  if (patch.enhancerKey === true) s.setHasKey('openai', true);
  s.setChannel('metal-rough');
  return store;
}

describe('describeGenerateAvailability with Metal-Roughness chosen (mask-generation R1)', () => {
  it('mask-generation R1 is enabled when the image model has its key and an automatic describe model exists (Gemini 3.8 Flash with a Gemini key)', () => {
    expect(describeGenerateAvailability(maskStore().getState())).toEqual({ action: 'generate', enabled: true, reason: null });
  });

  it('mask-generation R1 without any model that can describe the pictures the button is off with the exact reason', () => {
    const store = maskStore();
    store.getState().setCatalog({ gemini: [known('gemini', 'gemini-nano-banana-2.1')], openai: [], openrouter: [] }); // no vision-text model listed
    const result = describeGenerateAvailability(store.getState());
    expect(result).toMatchObject({ enabled: false, reason: NO_DESCRIBE_MODEL });
    expect(NO_DESCRIBE_MODEL).toBe('No model can describe the pictures. Add a Gemini or OpenAI key.');
  });

  it('mask-generation R1 a describe model chosen in Settings whose provider has no key is the same reason', () => {
    const store = maskStore({ enhancer: 'settings' });
    expect(describeGenerateAvailability(store.getState()).reason).toBe(NO_DESCRIBE_MODEL);
    store.getState().setHasKey('openai', true);
    expect(describeGenerateAvailability(store.getState()).enabled).toBe(true);
  });

  it('mask-generation R1 the image model problems come first', () => {
    const store = maskStore();
    store.getState().setHasKey('gemini', false);
    const result = describeGenerateAvailability(store.getState());
    expect(result.enabled).toBe(false);
    expect(result.reason).not.toBe(NO_DESCRIBE_MODEL);
  });

  it('mask-generation R1 a run in progress disables it, and an open set or a busy app keep their own reasons', () => {
    const store = maskStore();
    store.getState().beginRun();
    expect(describeGenerateAvailability(store.getState())).toMatchObject({ enabled: false, reason: 'A request is already running.' });
  });

  it('mask-generation R1 a plain Generate keeps working on Albedo of the same store', () => {
    const store = maskStore();
    store.getState().setChannel('albedo');
    expect(describeGenerateAvailability(store.getState()).action).toBe('generate');
  });
});
