import { describe, expect, it } from 'vitest';
import { KNOWN_MODELS } from '../../src/generation/catalog/knownModels';
import { describeGenerateAvailability } from '../../src/generation/generateAvailability';
import { createGenerateStore } from '../../src/generation/generateStore';
import type { CustomPlanRecord, SheetSettings } from '../../src/generation';

const SUNBURST: SheetSettings = { provider: 'openai', modelId: 'gpt-image-2.5-sunburst', resolutionKey: '1K', quality: 'low' };
const GONE: SheetSettings = { provider: 'openai', modelId: 'gpt-image-0-retired', resolutionKey: '1K', quality: null };
const planOf = (cameras: number[][], settings: SheetSettings = SUNBURST, aux: SheetSettings | null = SUNBURST): CustomPlanRecord => ({ sheets: cameras.map((c) => ({ cameras: c, settings })), aux: aux === null ? null : { settings: aux } });

function readyStore() {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  s.setCatalog({ gemini: KNOWN_MODELS.filter((model) => model.provider === 'gemini'), openai: KNOWN_MODELS.filter((model) => model.provider === 'openai') });
  s.setSceneState({ hasModel: true, hasUvs: true });
  s.setHasKey('openai', true);
  s.setHasKey('gemini', true);
  s.selectModel('openai', 'gpt-image-2.5-sunburst');
  return store;
}

describe('generate store: custom settings (custom R1, R6, R28)', () => {
  it('custom R1 starts in Standard with no plan and no saved setups', () => {
    const state = createGenerateStore().getState();
    expect([state.mode, state.customPlan, state.customSetups]).toEqual(['standard', null, []]);
  });

  it('custom R1 the mode is switched by setMode and the other fields stay', () => {
    const store = readyStore();
    store.getState().setPrompt('steel');
    store.getState().setMode('custom');
    expect(store.getState()).toMatchObject({ mode: 'custom', prompt: 'steel', modelId: 'gpt-image-2.5-sunburst' });
  });

  it('custom R7 Confirm makes the plan the active plan', () => {
    const store = readyStore();
    const plan = planOf([[0, 1]]);
    store.getState().confirmCustomPlan(plan);
    expect(store.getState().customPlan).toEqual(plan);
  });

  it('custom R6 a saved setup is listed oldest first, a name used again replaces it in place, delete removes it', () => {
    const store = readyStore();
    const state = () => store.getState();
    state().saveCustomSetup('A', planOf([[0]]));
    state().saveCustomSetup('B', planOf([[1]]));
    state().saveCustomSetup('A', planOf([[2]]));
    expect(state().customSetups).toEqual([{ name: 'A', plan: planOf([[2]]) }, { name: 'B', plan: planOf([[1]]) }]);
    state().deleteCustomSetup('A');
    expect(state().customSetups.map((setup) => setup.name)).toEqual(['B']);
  });

  it('custom R28 restoring a project brings back its mode, plan and setups', () => {
    const store = readyStore();
    const plan = planOf([[0, 1]]);
    store.getState().restoreSettings({ ...pick(store.getState()), mode: 'custom', customPlan: plan, customSetups: [{ name: 'Mine', plan }] });
    expect(store.getState()).toMatchObject({ mode: 'custom', customPlan: plan, customSetups: [{ name: 'Mine', plan }] });
  });

  it('custom R28 a plan that names a model the catalog does not list keeps its sheets', () => {
    const store = readyStore();
    const plan = planOf([[0], [1]], GONE);
    store.getState().confirmCustomPlan(plan);
    store.getState().setCatalog({ gemini: [], openai: KNOWN_MODELS.filter((model) => model.provider === 'openai') });
    expect(store.getState().customPlan).toEqual(plan);
  });
});

function pick(state: ReturnType<ReturnType<typeof createGenerateStore>['getState']>) {
  const { prompt, references, provider, modelId, resolutionKey, atlasKey, atlasRender, tileBorder, quality } = state;
  return { prompt, references, provider, modelId, resolutionKey, atlasKey, atlasRender, tileBorder, quality, mode: state.mode, customPlan: state.customPlan, customSetups: state.customSetups };
}

describe('describeGenerateAvailability: Custom (custom R1, R7, R19)', () => {
  const custom = (plan: CustomPlanRecord | null) => {
    const store = readyStore();
    store.getState().setEnhancer({ provider: 'openai', modelId: 'gpt-6-astra' });
    store.getState().setMode('custom');
    if (plan !== null) store.getState().confirmCustomPlan(plan);
    return store;
  };
  const describeNow = (store: ReturnType<typeof readyStore>) => describeGenerateAvailability(store.getState());

  it('custom R1 with no confirmed plan the button is off with the set-up reason', () => {
    expect(describeNow(custom(null))).toEqual({ action: 'generate', enabled: false, reason: 'Set up the custom generation first.' });
  });

  it('custom R1 an empty plan (no camera on any image) is off with the assign reason', () => {
    expect(describeNow(custom(planOf([[]])))).toMatchObject({ enabled: false, reason: 'Assign at least one camera to an image.' });
    expect(describeNow(custom({ sheets: [], aux: null }))).toMatchObject({ enabled: false, reason: 'Assign at least one camera to an image.' });
  });

  it('custom R19 a sheet whose model is gone gives the reason, naming the image', () => {
    const result = describeNow(custom({ sheets: [{ cameras: [0], settings: SUNBURST }, { cameras: [1], settings: GONE }], aux: null }));
    expect(result).toMatchObject({ enabled: false });
    expect(result.reason).toMatch(/^Image 2: The chosen image model is no longer available/);
  });

  it('custom R19 the first provider without a key gives the reason', () => {
    const store = custom(planOf([[0]], { ...SUNBURST, provider: 'gemini', modelId: 'gemini-nano-banana-2.1', quality: null }, null));
    store.getState().setHasKey('gemini', false);
    expect(describeNow(store).reason).toMatch(/^Image 1: Add a Gemini key in Settings/);
  });

  it('custom R19 the prompt enhancer needs its key too', () => {
    const store = custom(planOf([[0]]));
    store.getState().setEnhancer({ provider: 'gemini', modelId: 'gemini-3.8-flash' });
    store.getState().setHasKey('gemini', false);
    expect(describeNow(store).reason).toMatch(/Add an? Gemini key in Settings for the prompt enhancer/);
  });

  it('custom R1 a valid plan enables the button and reports how many images it requests', () => {
    expect(describeNow(custom(planOf([[0], [2], [1, 3], [4, 5]])))).toEqual({ action: 'generate', enabled: true, reason: null, imageCount: 5 });
  });

  it('custom R1 Standard mode is unchanged by a stored plan', () => {
    const store = custom(null);
    store.getState().setMode('standard');
    expect(describeNow(store)).toEqual({ action: 'generate', enabled: true, reason: null });
  });
});

describe('generate store: failed sheets (custom R29)', () => {
  const error = { category: 'server' as const, retryable: true, message: 'x' };

  it('custom R29 a failed run keeps the numbers of the sheets that failed; none by default', () => {
    const store = createGenerateStore();
    expect(store.getState().failedSheets).toEqual([]);
    store.getState().failRun(error);
    expect(store.getState().failedSheets).toEqual([]);
    store.getState().failRun(error, [2, 3]);
    expect(store.getState().failedSheets).toEqual([2, 3]);
  });

  it('custom R29 changing the mode forgets a failed run, so its Retry is not shown for the other mode', () => {
    const store = createGenerateStore();
    store.getState().failRun(error, [2]);
    store.getState().setMode('custom');
    expect(store.getState()).toMatchObject({ status: 'idle', error: null, failedSheets: [] });
  });

  it('custom R1 changing the mode during a run leaves the run alone', () => {
    const store = createGenerateStore();
    store.getState().beginRun();
    store.getState().setMode('custom');
    expect(store.getState().status).toBe('running');
  });

  it('custom R29 a new run or clearing the run forgets them', () => {
    const store = createGenerateStore();
    store.getState().failRun(error, [2]);
    store.getState().beginRun();
    expect(store.getState().failedSheets).toEqual([]);
    store.getState().failRun(error, [1]);
    store.getState().clearRun();
    expect(store.getState().failedSheets).toEqual([]);
  });
});
