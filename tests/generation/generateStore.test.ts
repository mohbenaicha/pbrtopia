import { describe, expect, it } from 'vitest';
import { findKnownModel } from '../../src/generation/catalog/knownModels';
import type { ModelInfo } from '../../src/generation/catalog/modelTypes';
import { createGenerateStore, type ReferenceImage } from '../../src/generation/generateStore';

const known = (provider: 'gemini' | 'openai', id: string): ModelInfo => {
  const entry = findKnownModel(provider, id);
  if (entry === null) throw new Error(`${id} is not in the table`);
  return entry;
};
const unverified: ModelInfo = { provider: 'openai', id: 'gpt-image-9-mystery', role: 'image', displayName: 'gpt-image-9-mystery', verified: false, resolutions: [], qualityLevels: [] };
const NANO = known('gemini', 'gemini-nano-banana-2.1');
const FLASH = known('gemini', 'gemini-3.1-flash-image');
const LITE = known('gemini', 'gemini-3.1-flash-lite-image');
const SUNBURST = known('openai', 'gpt-image-2.5-sunburst');

const image = (id: string): ReferenceImage => ({ id, name: `${id}.png`, width: 64, height: 64, blob: new Blob(['x'], { type: 'image/png' }) });

function setup() {
  const store = createGenerateStore();
  store.getState().setMaxTextureSize(8192);
  store.getState().setCatalog({ gemini: [NANO, FLASH, LITE], openai: [SUNBURST, unverified] });
  return store;
}

describe('generateStore: model, resolution and quality (R4, R5)', () => {
  it('R4 starts with nothing chosen, albedo as the channel and an empty prompt', () => {
    const s = createGenerateStore().getState();
    expect(s).toMatchObject({ prompt: '', channel: 'albedo', provider: null, modelId: null, resolutionKey: null, quality: null, references: [] });
  });

  it('R4 choosing a model sets 2K when it is offered, with the model default quality', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    expect(store.getState()).toMatchObject({ provider: 'gemini', modelId: 'gemini-nano-banana-2.1', resolutionKey: '2K', quality: 'medium' });
  });

  it('R4 a model that offers only 1K gets 1K', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-3.1-flash-lite-image');
    expect(store.getState().resolutionKey).toBe('1K');
  });

  it('R4 changing the model keeps the size and level the new model also offers', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    store.getState().setResolution('4K');
    store.getState().setQuality('high');
    store.getState().selectModel('gemini', 'gemini-3.1-flash-image');
    expect(store.getState()).toMatchObject({ resolutionKey: '4K', quality: 'high' });
  });

  it('R5 a level the new model lacks is replaced by its default, and no level is renamed', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    store.getState().setQuality('medium');
    store.getState().selectModel('gemini', 'gemini-3.1-flash-image');
    expect(store.getState().quality).toBe('minimal');
    store.getState().selectModel('openai', 'gpt-image-2.5-sunburst');
    expect(store.getState().quality).toBe('auto');
  });

  it('R4 a size the GPU cannot make is not offered and not chosen', () => {
    const store = setup();
    store.getState().setMaxTextureSize(2048);
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    store.getState().setResolution('4K');
    expect(store.getState().resolutionKey).toBe('2K');
  });

  it('R5 setResolution and setQuality ignore a value the selected model does not offer', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-3.1-flash-image');
    store.getState().setQuality('xhigh');
    store.getState().setResolution('2.8K');
    expect(store.getState()).toMatchObject({ resolutionKey: '2K', quality: 'minimal' });
  });

  it('R4 an unverified model is selectable but has no size and no level', () => {
    const store = setup();
    store.getState().selectModel('openai', 'gpt-image-9-mystery');
    expect(store.getState()).toMatchObject({ modelId: 'gpt-image-9-mystery', resolutionKey: null, quality: null });
  });

  it('R4 a model that is not in the catalog cannot be selected', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    store.getState().selectModel('gemini', 'no-such-model');
    expect(store.getState().modelId).toBe('gemini-nano-banana-2.1');
  });

  it('R4 a new catalog that no longer lists the selected model clears the selection and keeps the prompt', () => {
    const store = setup();
    store.getState().setPrompt('a mossy stone');
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    store.getState().setCatalog({ gemini: [FLASH], openai: [] });
    expect(store.getState()).toMatchObject({ provider: null, modelId: null, resolutionKey: null, quality: null, prompt: 'a mossy stone' });
  });

  it('R4 a new catalog that still lists the selected model keeps the selection and refreshes its options', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-3.1-flash-image');
    store.getState().setResolution('4K');
    store.getState().setCatalog({ gemini: [{ ...FLASH, resolutions: [{ key: '1K', sizePx: 1024 }] }], openai: [] });
    expect(store.getState()).toMatchObject({ modelId: 'gemini-3.1-flash-image', resolutionKey: '1K' });
  });
});

describe('generateStore: references (R2)', () => {
  it('R2 adds references in order and removes one by id', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    expect(store.getState().addReferences([image('a'), image('b'), image('c')])).toEqual({ added: 3, refused: 0 });
    store.getState().removeReference('b');
    expect(store.getState().references.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('R2 refuses what does not fit under maxReferenceImages - 1 and says how many', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1'); // 14 images in total: 13 references
    const many = Array.from({ length: 15 }, (_, i) => image(`r${i}`));
    expect(store.getState().addReferences(many)).toEqual({ added: 13, refused: 2 });
    expect(store.getState().references).toHaveLength(13);
    expect(store.getState().addReferences([image('x')])).toEqual({ added: 0, refused: 1 });
  });

  it('R2 a model with no cap in the table takes any number', () => {
    const store = setup();
    store.getState().selectModel('openai', 'gpt-image-2.5-sunburst');
    expect(store.getState().addReferences(Array.from({ length: 30 }, (_, i) => image(`r${i}`)))).toEqual({ added: 30, refused: 0 });
  });

  it('R2 with no model chosen nothing is refused', () => {
    const store = setup();
    expect(store.getState().addReferences([image('a')])).toEqual({ added: 1, refused: 0 });
  });

  it('R2 a repeated id is not added twice', () => {
    const store = setup();
    store.getState().addReferences([image('a')]);
    expect(store.getState().addReferences([image('a')])).toEqual({ added: 0, refused: 0 });
  });

  it('R2 switching to a model with a lower cap keeps the references already added', () => {
    const store = setup();
    store.getState().addReferences(Array.from({ length: 5 }, (_, i) => image(`r${i}`)));
    store.getState().selectModel('gemini', 'gemini-3.1-flash-lite-image');
    expect(store.getState().references).toHaveLength(5);
  });
});

describe('generateStore: scene, keys and enhancer inputs (R6)', () => {
  it('R6 setters store what app/ feeds it', () => {
    const store = createGenerateStore();
    store.getState().setHasKey('gemini', true);
    store.getState().setEnhancer({ provider: 'gemini', modelId: 'gemini-3.8-flash' });
    store.getState().setSceneState({ hasModel: true, hasUvs: false });
    expect(store.getState()).toMatchObject({ hasKey: { gemini: true, openai: false }, enhancer: { provider: 'gemini', modelId: 'gemini-3.8-flash' }, hasModel: true, hasUvs: false });
  });

  it('R9 the prompt, references and settings are not touched by a run failing', () => {
    const store = setup();
    store.getState().setPrompt('a mossy stone');
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    store.getState().addReferences([image('a')]);
    const before = JSON.stringify({ ...store.getState(), references: store.getState().references.map((r) => r.id) });
    store.getState().beginRun();
    store.getState().failRun({ category: 'server', retryable: true, message: 'busy' });
    expect(store.getState()).toMatchObject({ status: 'failed', error: { category: 'server' } });
    store.getState().clearRun();
    const after = JSON.stringify({ ...store.getState(), references: store.getState().references.map((r) => r.id) });
    expect(after).toBe(before);
  });

  it('R10 run state moves idle, running with a step and a fraction, then back to idle', () => {
    const store = createGenerateStore();
    store.getState().beginRun();
    expect(store.getState()).toMatchObject({ status: 'running', step: 'capture', fraction: 0, error: null });
    store.getState().setStep('enhance', 0.4);
    expect(store.getState()).toMatchObject({ step: 'enhance', fraction: 0.4 });
    store.getState().setStep('generate', 7); // out of range is clamped
    expect(store.getState().fraction).toBe(1);
    store.getState().setEnhancedPrompt('A stone with moss on the left.');
    store.getState().clearRun();
    expect(store.getState()).toMatchObject({ status: 'idle', step: null, fraction: 0, error: null });
  });
});
