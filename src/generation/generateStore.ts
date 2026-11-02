import { createStore } from 'zustand';
import type { Provider } from '../keys';
import { DEFAULT_ATLAS_KEY, listAtlasSizes, type AtlasKey } from './catalog/atlasSizes';
import { DEFAULT_ATLAS_RENDER, type AtlasRender } from './atlasRender';
import type { EnhancerSnapshot } from './enhancerSnapshot';
import { DEFAULT_IMAGE_MODEL } from './catalog/knownModels';
import { chooseQualityLevel, optionsForModel } from './catalog/optionsForModel';
import { countUserReferenceSlots } from './catalog/referenceSlots';
import type { ProviderModelRecord, ResolutionKey } from './catalog/modelTypes';
import type { CustomPlanRecord, NamedPlanRecord } from './custom/planTypes';
import type { ProviderErrorCategory } from './providers/providerTypes';

export interface ReferenceImage {
  id: string;
  name: string;
  width: number;
  height: number;
  blob: Blob;
}

export type RunStep = 'capture' | 'enhance' | 'generate' | 'validate';
type RunStatus ='idle' | 'running' | 'failed';
// What the panel shows for a failed run: any ProviderError fits; the flow adds the categories of the steps that are not provider calls.
export interface RunError {
  category: ProviderErrorCategory | 'validation' | 'storage-failed' | 'engine';
  retryable: boolean;
  message: string;
  details?: string;
  retryAfterMs?: number;
}
// The Generate UV run (R17): progress and the error to show. Separate from the Generate run above.
export interface UnwrapState {
  status: RunStatus;
  fraction: number; // 0-1 over the whole unwrap
  error: RunError | null;
}
export type ModelCatalog = Record<Provider, ProviderModelRecord[]>;
export interface EnhancerChoice {
  provider: Provider;
  modelId: string;
}

/** What the app tells the panel about the open project; the three flags of R18 default to false. */
interface SceneState {
  hasModel: boolean;
  hasUvs: boolean;
  readOnly?: boolean;
  setOpen?: boolean;
  setBusy?: boolean;
}

/** What the project saves of the panel (R22). */
export interface SavedPanelSettings {
  prompt: string;
  references: ReferenceImage[];
  provider: Provider | null;
  modelId: string | null;
  resolutionKey: ResolutionKey | null;
  atlasKey: AtlasKey;
  atlasRender: AtlasRender;
  tileBorder: boolean;
  quality: string | null;
  // Custom R28: left out, the panel keeps what it has (a record saved before Custom existed is read with the defaults by the reader).
  mode?: GenerateMode;
  customPlan?: CustomPlanRecord | null;
  customSetups?: NamedPlanRecord[];
}

export type GenerateMode = 'standard' | 'custom';

export interface GenerateState {
  prompt: string;
  references: ReferenceImage[];
  channel: 'albedo';
  provider: Provider | null;
  modelId: string | null;
  resolutionKey: ResolutionKey | null; // the output size asked of the model (R4)
  atlasKey: AtlasKey; // the size of the atlas sent in (R16); independent of the model and the output size
  atlasRender: AtlasRender; // how the atlas snapshots are drawn (R37); independent of everything else in the panel
  tileBorder: boolean; // a white border around every atlas tile (R40)
  quality: string | null;
  mode: GenerateMode; // custom R1: Standard is the one-image flow, Custom the per-image plan
  customPlan: CustomPlanRecord | null; // the confirmed plan (R7); null until the first Confirm
  customSetups: NamedPlanRecord[]; // saved setups, oldest first (R6)
  // fed by app/
  catalog: ModelCatalog;
  hasKey: Record<Provider, boolean>;
  enhancer: EnhancerChoice | null;
  maxTextureSize: number;
  hasModel: boolean;
  hasUvs: boolean;
  readOnly: boolean; // the project is open in another tab (R18)
  setOpen: boolean; // a projection set is open (R18)
  setBusy: boolean; // a set is being entered or left (R18)
  // run state
  status: RunStatus;
  step: RunStep | null;
  fraction: number;
  error: RunError | null;
  failedSheets: number[]; // custom R29: the images (0-based) that failed in the last custom run
  notice: string | null; // a plain message that is not a failure (R19: the set is saved but could not be opened)
  enhancerSnapshot: EnhancerSnapshot | null; // R41: the last enhancer call of the open project; in memory only, not part of the saved settings
  unwrap: UnwrapState;
  setPrompt: (prompt: string) => void;
  restoreSettings: (settings: SavedPanelSettings) => void;
  setNotice: (notice: string | null) => void;
  setEnhancerSnapshot: (snapshot: EnhancerSnapshot | null) => void;
  addReferences: (images: ReferenceImage[]) => { added: number; refused: number };
  removeReference: (id: string) => void;
  selectModel: (provider: Provider, modelId: string) => void;
  setResolution: (key: ResolutionKey) => void;
  setAtlasKey: (key: AtlasKey) => void;
  setAtlasRender: (render: AtlasRender) => void;
  setTileBorder: (on: boolean) => void;
  setQuality: (level: string) => void;
  setMode: (mode: GenerateMode) => void;
  confirmCustomPlan: (plan: CustomPlanRecord) => void;
  saveCustomSetup: (name: string, plan: CustomPlanRecord) => void;
  deleteCustomSetup: (name: string) => void;
  setCatalog: (catalog: ModelCatalog) => void;
  setHasKey: (provider: Provider, has: boolean) => void;
  setEnhancer: (enhancer: EnhancerChoice | null) => void;
  setMaxTextureSize: (size: number) => void;
  setSceneState: (scene: SceneState) => void;
  beginRun: () => void;
  setStep: (step: RunStep, fraction: number) => void;
  failRun: (error: RunError, failedSheets?: number[]) => void; // custom R29: the indices of the images that failed, for Keep without
  clearRun: () => void;
  beginUnwrap: () => void;
  setUnwrapProgress: (fraction: number) => void;
  failUnwrap: (error: RunError) => void;
  clearUnwrap: () => void;
}

type Selection = Pick<GenerateState, 'provider' | 'modelId' | 'resolutionKey' | 'quality'>;
const NO_SELECTION: Selection = { provider: null, modelId: null, resolutionKey: null, quality: null };

export const findCatalogModel = (catalog: ModelCatalog, provider: Provider | null, modelId: string | null): ProviderModelRecord | null =>
  provider === null || modelId === null ? null : (catalog[provider].find((model) => model.id === modelId) ?? null);
const findModel = findCatalogModel;

// R4, R5: the output size and level for a model: the current ones when the model offers them, else the smallest size; else the model's default level.
function settleSelection(catalog: ModelCatalog, maxTextureSize: number, provider: Provider, modelId: string, current: Selection): Selection {
  const info = findModel(catalog, provider, modelId);
  if (info === null) return NO_SELECTION;
  const { resolutions } = optionsForModel(info, maxTextureSize);
  const keys = resolutions.map((option) => option.key);
  const resolutionKey = current.resolutionKey !== null && keys.includes(current.resolutionKey) ? current.resolutionKey : (keys[0] ?? null);
  return { provider, modelId, resolutionKey, quality: chooseQualityLevel(info, current.quality ?? '') };
}

// R16: the atlas size stays unless the device cannot make it; then the default (1K), else the largest the device can make. A device size not yet known (0) changes nothing.
function settleAtlasKey(current: AtlasKey, maxTextureSize: number): AtlasKey {
  const keys = listAtlasSizes(maxTextureSize).map((option) => option.key);
  if (keys.length === 0 || keys.includes(current)) return current;
  return keys.includes(DEFAULT_ATLAS_KEY) ? DEFAULT_ATLAS_KEY : keys[keys.length - 1]!;
}

const IDLE_UNWRAP: UnwrapState = { status: 'idle', fraction: 0, error: null };
const clamp01 =(value: number): number => Math.min(1, Math.max(0, value));

export function createGenerateStore() {
  return createStore<GenerateState>()((set, get) => {
    const resettle = (patch: Partial<Pick<GenerateState, 'catalog' | 'maxTextureSize'>>): void => {
      const next = { ...get(), ...patch };
      const { provider, modelId } = next;
      // A chosen model that the list lacks stays chosen (a saved choice survives a list that is still loading); it settles when it is listed.
      // With no model chosen, the default model (R4) is taken as soon as the list has it.
      const wanted = provider !== null && modelId !== null ? { provider, id: modelId } : DEFAULT_IMAGE_MODEL;
      const settled = findModel(next.catalog, wanted.provider, wanted.id) !== null ? settleSelection(next.catalog, next.maxTextureSize, wanted.provider, wanted.id, next) : {};
      set({ ...patch, atlasKey: settleAtlasKey(next.atlasKey, next.maxTextureSize), ...settled });
    };
    return {
      prompt: '',
      references: [],
      channel: 'albedo',
      ...NO_SELECTION,
      atlasKey: DEFAULT_ATLAS_KEY,
      atlasRender: DEFAULT_ATLAS_RENDER,
      tileBorder: true,
      mode: 'standard',
      customPlan: null,
      customSetups: [],
      catalog: { gemini: [], openai: [] },
      hasKey: { gemini: false, openai: false },
      enhancer: null,
      maxTextureSize: 0,
      hasModel: false,
      hasUvs: false,
      readOnly: false,
      setOpen: false,
      setBusy: false,
      status: 'idle',
      step: null,
      fraction: 0,
      error: null,
      failedSheets: [],
      notice: null,
      enhancerSnapshot: null,
      unwrap: IDLE_UNWRAP,
      setPrompt: (prompt) => set({ prompt }),
      restoreSettings: (settings) => {
        set(settings);
        resettle({});
      },
      setNotice: (notice) => set({ notice }),
      setEnhancerSnapshot: (enhancerSnapshot) => set({ enhancerSnapshot }),
      addReferences: (images) => {
        const { references, catalog, provider, modelId, mode, customPlan } = get();
        const known = new Set(references.map((reference) => reference.id));
        const fresh = images.filter((image, index) => !known.has(image.id) && images.findIndex((other) => other.id === image.id) === index);
        const lead = mode === 'custom' ? customPlan?.sheets[0]?.settings : undefined; // custom R13: the lead sheet's model takes the user's references
        const limiting = lead === undefined ? findModel(catalog, provider, modelId) : findModel(catalog, lead.provider, lead.modelId);
        const room = Math.max(0, countUserReferenceSlots(limiting) - references.length);
        const accepted = fresh.slice(0, room);
        set({ references: [...references, ...accepted] });
        return { added: accepted.length, refused: fresh.length - accepted.length };
      },
      removeReference: (id) => set({ references: get().references.filter((reference) => reference.id !== id) }),
      selectModel: (provider, modelId) => {
        const { catalog, maxTextureSize } = get();
        if (findModel(catalog, provider, modelId) === null) return;
        set(settleSelection(catalog, maxTextureSize, provider, modelId, get()));
      },
      setResolution: (key) => {
        const { catalog, provider, modelId, maxTextureSize } = get();
        const info = findModel(catalog, provider, modelId);
        if (info !== null && optionsForModel(info, maxTextureSize).resolutions.some((option) => option.key === key)) set({ resolutionKey: key });
      },
      setAtlasKey: (key) => {
        if (listAtlasSizes(get().maxTextureSize).some((option) => option.key === key)) set({ atlasKey: key });
      },
      setAtlasRender: (atlasRender) => set({ atlasRender }),
      setTileBorder: (tileBorder) => set({ tileBorder }),
      setQuality: (level) => {
        const { catalog, provider, modelId, maxTextureSize } = get();
        const info = findModel(catalog, provider, modelId);
        if (info !== null && optionsForModel(info, maxTextureSize).qualityLevels.includes(level)) set({ quality: level });
      },
      setMode: (mode) => set((state) => (state.status === 'failed' ? { mode, status: 'idle', step: null, fraction: 0, error: null, failedSheets: [] } : { mode })), // a failed run belongs to the mode it ran in
      confirmCustomPlan: (customPlan) => set({ customPlan }),
      saveCustomSetup: (name, plan) => {
        const { customSetups } = get();
        const same = customSetups.findIndex((setup) => setup.name === name);
        set({ customSetups: same < 0 ? [...customSetups, { name, plan }] : customSetups.map((setup, index) => (index === same ? { name, plan } : setup)) });
      },
      deleteCustomSetup: (name) => set({ customSetups: get().customSetups.filter((setup) => setup.name !== name) }),
      setCatalog: (catalog) => resettle({ catalog }),
      setHasKey: (provider, has) => set({ hasKey: { ...get().hasKey, [provider]: has } }),
      setEnhancer: (enhancer) => set({ enhancer }),
      setMaxTextureSize: (maxTextureSize) => resettle({ maxTextureSize }),
      setSceneState: ({ hasModel, hasUvs, readOnly = false, setOpen = false, setBusy = false }) => set({ hasModel, hasUvs, readOnly, setOpen, setBusy }),
      beginRun: () => set({ status: 'running', step: 'capture', fraction: 0, error: null, failedSheets: [], notice: null }),
      setStep: (step, fraction) => set({ step, fraction: clamp01(fraction) }),
      failRun: (error, failedSheets = []) => set({ status: 'failed', error, failedSheets }),
      clearRun: () => set({ status: 'idle', step: null, fraction: 0, error: null, failedSheets: [] }),
      beginUnwrap: () => set({ unwrap: { status: 'running', fraction: 0, error: null } }),
      setUnwrapProgress: (fraction) => set({ unwrap: { ...get().unwrap, fraction: clamp01(fraction) } }),
      failUnwrap: (error) => set({ unwrap: { status: 'failed', fraction: 0, error } }),
      clearUnwrap: () => set({ unwrap: IDLE_UNWRAP }),
    };
  });
}

export const generateStore = createGenerateStore();
