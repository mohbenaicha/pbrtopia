import { describe, expect, it } from 'vitest';
import { createGenerateStore } from '../../src/generation/generateStore';

const withAlbedo = (ids: (string | null)[] = ['a', 'a'], square: boolean | null = true) => {
  const store = createGenerateStore();
  store.getState().setSceneState({ hasModel: true, hasUvs: true, albedoPictureIds: ids, sourceIsSquare: square });
  return store;
};

describe('generateStore: channel and Detail (normal-map R1, R3, R5)', () => {
  it('normal-map R1 starts on Albedo with Detail 2', () => {
    expect(createGenerateStore().getState()).toMatchObject({ channel: 'albedo', normalDetail: 2 });
  });

  it('normal-map R1 chooses Normal when one generated albedo covers the model, and Metal-Roughness the same way', () => {
    const store = withAlbedo();
    store.getState().setChannel('normal');
    expect(store.getState().channel).toBe('normal');
    store.getState().setChannel('metal-rough');
    expect(store.getState().channel).toBe('metal-rough');
    store.getState().setChannel('albedo');
    expect(store.getState().channel).toBe('albedo');
  });

  it('normal-map R11 a failed run belongs to its channel: choosing another channel clears the failure, choosing the same one keeps it', () => {
    const store = withAlbedo();
    store.getState().setChannel('normal');
    store.getState().beginRun();
    store.getState().failRun({ category: 'server', retryable: true, message: 'The provider failed.' });
    store.getState().setChannel('normal');
    expect(store.getState()).toMatchObject({ status: 'failed', channel: 'normal' });
    store.getState().setChannel('albedo');
    expect(store.getState()).toMatchObject({ status: 'idle', error: null, step: null, channel: 'albedo' });
  });

  it('normal-map R2 a channel that is not available cannot be chosen', () => {
    const store = withAlbedo([null, null]);
    store.getState().setChannel('normal');
    expect(store.getState().channel).toBe('albedo');
    const round = withAlbedo(['a', 'a'], false);
    round.getState().setChannel('normal');
    expect(round.getState().channel).toBe('albedo');
  });

  it('normal-map R3 falls back to Albedo when the albedo is removed or differs per material', () => {
    const store = withAlbedo();
    store.getState().setChannel('normal');
    store.getState().setSceneState({ hasModel: true, hasUvs: true, albedoPictureIds: [null, null], sourceIsSquare: null });
    expect(store.getState().channel).toBe('albedo');
    const split = withAlbedo();
    split.getState().setChannel('metal-rough');
    split.getState().setSceneState({ hasModel: true, hasUvs: true, albedoPictureIds: ['a', 'b'], sourceIsSquare: true });
    expect(split.getState().channel).toBe('albedo');
  });

  it('normal-map R3 keeps Normal while a run, a bake or an open set only makes it busy', () => {
    const store = withAlbedo();
    store.getState().setChannel('normal');
    store.getState().beginRun();
    expect(store.getState().channel).toBe('normal');
    store.getState().setSceneState({ hasModel: true, hasUvs: true, setBusy: true, albedoPictureIds: ['a', 'a'], sourceIsSquare: true });
    expect(store.getState().channel).toBe('normal');
    store.getState().setSceneState({ hasModel: true, hasUvs: true, setOpen: true, albedoPictureIds: ['a', 'a'], sourceIsSquare: true });
    expect(store.getState().channel).toBe('normal');
  });

  it('normal-map R3 a project that is not loaded yet (no model) does not reset a restored choice', () => {
    const store = createGenerateStore();
    store.getState().restoreSettings({ ...baseSettings(), channel: 'normal' });
    store.getState().setSceneState({ hasModel: false, hasUvs: false });
    expect(store.getState().channel).toBe('normal');
  });

  it('normal-map R3 restoring Normal into a model whose albedo is not one generated picture reads as Albedo', () => {
    const store = withAlbedo([null]);
    store.getState().restoreSettings({ ...baseSettings(), channel: 'normal' });
    expect(store.getState().channel).toBe('albedo');
  });

  it('normal-map R5 Detail clamps to 1..4 and rounds', () => {
    const store = createGenerateStore();
    store.getState().setNormalDetail(4);
    expect(store.getState().normalDetail).toBe(4);
    store.getState().setNormalDetail(9);
    expect(store.getState().normalDetail).toBe(4);
    store.getState().setNormalDetail(0);
    expect(store.getState().normalDetail).toBe(1);
    store.getState().setNormalDetail(2.6);
    expect(store.getState().normalDetail).toBe(3);
  });

  it('normal-map R5 restoring settings sets Detail; settings that leave it out keep what the panel has', () => {
    const store = createGenerateStore();
    store.getState().restoreSettings({ ...baseSettings(), normalDetail: 3 });
    expect(store.getState().normalDetail).toBe(3);
    store.getState().restoreSettings(baseSettings());
    expect(store.getState().normalDetail).toBe(3);
  });
});

function baseSettings() {
  return { prompt: '', references: [], provider: null, modelId: null, resolutionKey: null, atlasKey: '1K' as const, atlasRender: 'grey' as const, tileBorder: true, quality: null };
}
