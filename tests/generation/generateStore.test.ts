import { describe, expect, it } from 'vitest';
import { findKnownModel } from '../../src/generation/catalog/knownModels';
import type { ProviderModelRecord } from '../../src/generation/catalog/modelTypes';
import { createGenerateStore, type ReferenceImage } from '../../src/generation/generateStore';

const known = (provider: 'gemini' | 'openai', id: string): ProviderModelRecord => {
  const entry = findKnownModel(provider, id);
  if (entry === null) throw new Error(`${id} is not in the table`);
  return entry;
};
const unverified: ProviderModelRecord = { provider: 'openai', id: 'gpt-image-9-mystery', role: 'image', displayName: 'gpt-image-9-mystery', verified: false, resolutions: [], qualityLevels: [] };
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

  it('R4 choosing a model sets its smallest size, with the model default quality', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    expect(store.getState()).toMatchObject({ provider: 'gemini', modelId: 'gemini-nano-banana-2.1', resolutionKey: '1K', quality: 'minimal' });
  });

  it('R4 with no model saved, the list having GPT Image 2.5 Sunburst chooses it, at its smallest size and low quality', () => {
    const store = setup();
    expect(store.getState()).toMatchObject({ provider: 'openai', modelId: 'gpt-image-2.5-sunburst', resolutionKey: '1K', quality: 'low' });
  });

  it('R4 a list without Sunburst chooses nothing, and Sunburst is chosen when the list gets it', () => {
    const store = createGenerateStore();
    store.getState().setMaxTextureSize(8192);
    store.getState().setCatalog({ gemini: [NANO], openai: [] });
    expect(store.getState()).toMatchObject({ provider: null, modelId: null });
    store.getState().setCatalog({ gemini: [NANO], openai: [SUNBURST] });
    expect(store.getState().modelId).toBe('gpt-image-2.5-sunburst');
  });

  it('R4 a model chosen by the user or a saved project is never replaced by the default', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-3.1-flash-image');
    store.getState().setCatalog({ gemini: [NANO, FLASH, LITE], openai: [SUNBURST] });
    expect(store.getState().modelId).toBe('gemini-3.1-flash-image');
    store.getState().restoreSettings({ prompt: '', references: [], provider: 'gemini', modelId: 'gemini-nano-banana-2.1', resolutionKey: null, atlasKey: '1K', atlasRender: 'grey', quality: null });
    expect(store.getState()).toMatchObject({ modelId: 'gemini-nano-banana-2.1', resolutionKey: '1K', quality: 'minimal' });
  });

  it('R4 a project saved with no model gets the default model when restored', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-3.1-flash-image');
    store.getState().restoreSettings({ prompt: '', references: [], provider: null, modelId: null, resolutionKey: null, atlasKey: '1K', atlasRender: 'grey', quality: null });
    expect(store.getState()).toMatchObject({ provider: 'openai', modelId: 'gpt-image-2.5-sunburst' });
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
    expect(store.getState().quality).toBe('low');
  });

  it('R4 a size the GPU cannot make is not offered and not chosen', () => {
    const store = setup();
    store.getState().setMaxTextureSize(2048);
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    store.getState().setResolution('4K');
    expect(store.getState().resolutionKey).toBe('1K');
  });

  it('R5 setResolution and setQuality ignore a value the selected model does not offer', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-3.1-flash-image');
    store.getState().setQuality('xhigh');
    store.getState().setResolution('2.8K');
    expect(store.getState()).toMatchObject({ resolutionKey: '1K', quality: 'minimal' });
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

  it('R20 a new catalog that no longer lists the selected model keeps the selection as it was (a saved choice is never wiped) and the prompt', () => {
    const store = setup();
    store.getState().setPrompt('a mossy stone');
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    const before = store.getState();
    store.getState().setCatalog({ gemini: [FLASH], openai: [] });
    expect(store.getState()).toMatchObject({ provider: 'gemini', modelId: 'gemini-nano-banana-2.1', resolutionKey: before.resolutionKey, quality: before.quality, prompt: 'a mossy stone' });
    expect(store.getState().catalog.gemini).toEqual([FLASH]);
  });

  it('R20 a model missing from the catalog stays selected through a texture-size change and settles again when it is listed', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-3.1-flash-image');
    store.getState().setResolution('4K');
    store.getState().setCatalog({ gemini: [], openai: [] });
    store.getState().setMaxTextureSize(4096);
    expect(store.getState()).toMatchObject({ modelId: 'gemini-3.1-flash-image', resolutionKey: '4K' });
    store.getState().setCatalog({ gemini: [{ ...FLASH, resolutions: [{ key: '1K', sizePx: 1024 }] }], openai: [] });
    expect(store.getState()).toMatchObject({ modelId: 'gemini-3.1-flash-image', resolutionKey: '1K' });
  });

  it('R4 a new catalog that still lists the selected model keeps the selection and refreshes its options', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-3.1-flash-image');
    store.getState().setResolution('4K');
    store.getState().setCatalog({ gemini: [{ ...FLASH, resolutions: [{ key: '1K', sizePx: 1024 }] }], openai: [] });
    expect(store.getState()).toMatchObject({ modelId: 'gemini-3.1-flash-image', resolutionKey: '1K' });
  });
});

describe('generateStore: restoring a project\'s saved settings (R22) and the notice (R19)', () => {
  const saved = { prompt: 'saved prompt', references: [image('r1')], provider: 'gemini' as const, modelId: 'gemini-3.1-flash-image', resolutionKey: '4K' as const, atlasKey: '4K' as const, atlasRender: 'grey' as const, quality: 'high' };

  it('R22 restoreSettings sets the prompt, references, model, sizes and quality, and settles them against the list', () => {
    const store = setup();
    store.getState().restoreSettings(saved);
    expect(store.getState()).toMatchObject({ prompt: 'saved prompt', provider: 'gemini', modelId: 'gemini-3.1-flash-image', resolutionKey: '4K', atlasKey: '4K' });
    expect(store.getState().references.map((reference) => reference.id)).toEqual(['r1']);
  });

  it('R22 restoring a model that the list lacks keeps it (it is not wiped), and the rest is restored', () => {
    const store = createGenerateStore();
    store.getState().setMaxTextureSize(8192);
    store.getState().restoreSettings(saved);
    expect(store.getState()).toMatchObject({ prompt: 'saved prompt', provider: 'gemini', modelId: 'gemini-3.1-flash-image', resolutionKey: '4K', quality: 'high', atlasKey: '4K' });
    store.getState().setCatalog({ gemini: [FLASH], openai: [] });
    expect(store.getState().modelId).toBe('gemini-3.1-flash-image');
  });

  it('R22 restoring does not cap the saved references by the model\'s limit and replaces the earlier ones', () => {
    const store = setup();
    store.getState().addReferences([image('old')]);
    store.getState().restoreSettings({ ...saved, references: [image('a'), image('b'), image('c')] });
    expect(store.getState().references.map((reference) => reference.id)).toEqual(['a', 'b', 'c']);
  });

  it('R19 setNotice shows a notice that beginRun clears; failRun and clearRun leave it alone', () => {
    const store = createGenerateStore();
    store.getState().setNotice('The set is saved.');
    store.getState().failRun({ category: 'server', retryable: true, message: 'x' });
    expect(store.getState().notice).toBe('The set is saved.');
    store.getState().beginRun();
    expect(store.getState().notice).toBeNull();
  });
});

describe('generateStore: the atlas and the enhanced prompt live in the run log, not here (R28)', () => {
  it('R28 the run state holds no atlas preview and no enhanced prompt', () => {
    const state = createGenerateStore().getState();
    expect(state).not.toHaveProperty('atlasPreview');
    expect(state).not.toHaveProperty('enhancedPrompt');
    expect(state).not.toHaveProperty('setAtlasPreview');
    expect(state).not.toHaveProperty('setEnhancedPrompt');
  });
});

describe('generateStore: atlas size, separate from the output size (R16)', () => {
  it('R16 starts at 1K with no model chosen', () => {
    expect(createGenerateStore().getState().atlasKey).toBe('1K');
  });

  it('R16 the atlas size is 1K whatever output size the model offers', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-3.1-flash-lite-image');
    expect(store.getState()).toMatchObject({ resolutionKey: '1K', atlasKey: '1K' });
  });

  it('R16 changing the output size or the model never changes the atlas size', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    store.getState().setAtlasKey('4K');
    store.getState().setResolution('4K');
    store.getState().selectModel('gemini', 'gemini-3.1-flash-lite-image');
    store.getState().selectModel('openai', 'gpt-image-2.5-sunburst');
    expect(store.getState().atlasKey).toBe('4K');
  });

  it('R16 changing the atlas size never changes the output size', () => {
    const store = setup();
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1');
    store.getState().setResolution('4K');
    store.getState().setAtlasKey('2K');
    expect(store.getState().resolutionKey).toBe('4K');
  });

  it('R16 the atlas size can be set without any model chosen', () => {
    const store = setup();
    store.getState().setAtlasKey('4K');
    expect(store.getState().atlasKey).toBe('4K');
  });

  it('R16 a size the GPU cannot make is not chosen, and a chosen one it can no longer make falls back to 1K', () => {
    const store = setup();
    store.getState().setMaxTextureSize(2048);
    store.getState().setAtlasKey('4K');
    expect(store.getState().atlasKey).toBe('1K');
    store.getState().setAtlasKey('2K');
    expect(store.getState().atlasKey).toBe('2K');
    store.getState().setMaxTextureSize(1024);
    expect(store.getState().atlasKey).toBe('1K');
  });

  it('R16 a GPU limited to 1K gets the 1K atlas', () => {
    const store = setup();
    store.getState().setMaxTextureSize(1024);
    expect(store.getState().atlasKey).toBe('1K');
  });
});

describe('generateStore: unwrap state (R17)', () => {
  it('R17 starts idle with no progress and no error', () => {
    expect(createGenerateStore().getState().unwrap).toEqual({ status: 'idle', fraction: 0, error: null });
  });

  it('R17 beginUnwrap runs from zero, progress is clamped to 0-1, fail keeps the error, clear returns to idle', () => {
    const store = createGenerateStore();
    store.getState().beginUnwrap();
    expect(store.getState().unwrap).toEqual({ status: 'running', fraction: 0, error: null });
    store.getState().setUnwrapProgress(0.4);
    expect(store.getState().unwrap.fraction).toBe(0.4);
    store.getState().setUnwrapProgress(7);
    expect(store.getState().unwrap.fraction).toBe(1);
    store.getState().setUnwrapProgress(-1);
    expect(store.getState().unwrap.fraction).toBe(0);
    const error = { category: 'engine' as const, retryable: false, message: 'too many vertices' };
    store.getState().failUnwrap(error);
    expect(store.getState().unwrap).toEqual({ status: 'failed', fraction: 0, error });
    store.getState().clearUnwrap();
    expect(store.getState().unwrap).toEqual({ status: 'idle', fraction: 0, error: null });
  });

  it('R17 an unwrap does not touch the Generate run state', () => {
    const store = createGenerateStore();
    store.getState().beginUnwrap();
    expect(store.getState()).toMatchObject({ status: 'idle', step: null });
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

  it('R2 switching to a model with a lower cap keeps the references already added, and adds no more', () => {
    const store = setup();
    store.getState().selectModel('openai', 'gpt-image-2.5-sunburst'); // no cap
    store.getState().addReferences(Array.from({ length: 20 }, (_, i) => image(`r${i}`)));
    store.getState().selectModel('gemini', 'gemini-nano-banana-2.1'); // cap 13
    expect(store.getState().references).toHaveLength(20);
    expect(store.getState().addReferences([image('more')])).toEqual({ added: 0, refused: 1 });
    expect(store.getState().references).toHaveLength(20);
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
    store.getState().clearRun();
    expect(store.getState()).toMatchObject({ status: 'idle', step: null, fraction: 0, error: null });
  });
});

describe('generateStore: atlas render (R37)', () => {
  const saved = { prompt: '', references: [], provider: null, modelId: null, resolutionKey: null, atlasKey: '1K' as const, quality: null };

  it('R37 starts on the grey render and setAtlasRender changes it', () => {
    const store = createGenerateStore();
    expect(store.getState().atlasRender).toBe('grey');
    store.getState().setAtlasRender('viewport');
    expect(store.getState().atlasRender).toBe('viewport');
  });

  it('R37 neither the model, the resolution nor the atlas size changes the render', () => {
    const store = createGenerateStore();
    store.getState().setMaxTextureSize(8192);
    store.getState().setCatalog({ gemini: [NANO, FLASH], openai: [] });
    store.getState().setAtlasRender('viewport');
    store.getState().selectModel('gemini', 'gemini-3.1-flash-image');
    store.getState().setResolution('2K');
    store.getState().setAtlasKey('4K');
    expect(store.getState().atlasRender).toBe('viewport');
  });

  it('R37 restoreSettings takes the saved render', () => {
    const store = createGenerateStore();
    store.getState().restoreSettings({ ...saved, atlasRender: 'viewport' });
    expect(store.getState().atlasRender).toBe('viewport');
    store.getState().restoreSettings({ ...saved, atlasRender: 'grey' });
    expect(store.getState().atlasRender).toBe('grey');
  });
});
