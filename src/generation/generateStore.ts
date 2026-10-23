import { createStore, useStore } from 'zustand';
import type { Provider } from '../keys';
import { DEFAULT_ATLAS_KEY, listAtlasSizes, type AtlasKey } from './catalog/atlasSizes';
import { chooseQualityLevel, optionsForModel } from './catalog/optionsForModel';
import type { ProviderModelRecord, ResolutionKey } from './catalog/modelTypes';
import type { ProviderErrorCategory } from './providers/providerTypes';

export interface ReferenceImage {
  id: string;
  name: string;
  width: number;
  height: number;
  blob: Blob;
}

export type RunStep = 'capture' | 'enhance' | 'generate' | 'validate';
export type RunStatus = 'idle' | 'running' | 'failed';
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
export interface SceneState {
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
  quality: string | null;
}

export interface GenerateState {
  prompt: string;
  references: ReferenceImage[];
  channel: 'albedo';
  provider: Provider | null;
  modelId: string | null;
  resolutionKey: ResolutionKey | null; // the output size asked of the model (R4)
  atlasKey: AtlasKey; // the size of the atlas sent in (R16); independent of the model and the output size
  quality: string | null;
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
  enhancedPrompt: string | null;
  atlasPreview: Blob | null; // the captured atlas, docked in the viewport while a run is going (R10)
  notice: string | null; // a plain message that is not a failure (R19: the set is saved but could not be opened)
  unwrap: UnwrapState;
  setPrompt: (prompt: string) => void;
  restoreSettings: (settings: SavedPanelSettings) => void;
  setNotice: (notice: string | null) => void;
  addReferences: (images: ReferenceImage[]) => { added: number; refused: number };
  removeReference: (id: string) => void;
  selectModel: (provider: Provider, modelId: string) => void;
  setResolution: (key: ResolutionKey) => void;
  setAtlasKey: (key: AtlasKey) => void;
  setQuality: (level: string) => void;
  setCatalog: (catalog: ModelCatalog) => void;
  setHasKey: (provider: Provider, has: boolean) => void;
  setEnhancer: (enhancer: EnhancerChoice | null) => void;
  setMaxTextureSize: (size: number) => void;
  setSceneState: (scene: SceneState) => void;
  beginRun: () => void;
  setStep: (step: RunStep, fraction: number) => void;
  setEnhancedPrompt: (text: string | null) => void;
  setAtlasPreview: (atlas: Blob | null) => void;
  failRun: (error: RunError) => void;
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

// R4, R5: the output size and level for a model: the current ones when the model offers them, else 2K, else the first size; else the model's default level.
function settleSelection(catalog: ModelCatalog, maxTextureSize: number, provider: Provider, modelId: string, current: Selection): Selection {
  const info = findModel(catalog, provider, modelId);
  if (info === null) return NO_SELECTION;
  const { resolutions } = optionsForModel(info, maxTextureSize);
  const keys = resolutions.map((option) => option.key);
  const resolutionKey = current.resolutionKey !== null && keys.includes(current.resolutionKey) ? current.resolutionKey : keys.includes('2K') ? '2K' : (keys[0] ?? null);
  return { provider, modelId, resolutionKey, quality: chooseQualityLevel(info, current.quality ?? '') };
}

// R16: the atlas size stays unless the device cannot make it; then 2K, else the largest the device can make. A device size not yet known (0) changes nothing.
function settleAtlasKey(current: AtlasKey, maxTextureSize: number): AtlasKey {
  const keys = listAtlasSizes(maxTextureSize).map((option) => option.key);
  if (keys.length === 0 || keys.includes(current)) return current;
  return keys.includes(DEFAULT_ATLAS_KEY) ? DEFAULT_ATLAS_KEY : keys[keys.length - 1]!;
}

const referenceCap =(info: ProviderModelRecord | null): number => (info?.maxReferenceImages === undefined ? Infinity : Math.max(0, info.maxReferenceImages - 1));
const IDLE_UNWRAP: UnwrapState = { status: 'idle', fraction: 0, error: null };
const clamp01 =(value: number): number => Math.min(1, Math.max(0, value));

export function createGenerateStore() {
  return createStore<GenerateState>()((set, get) => {
    const resettle = (patch: Partial<Pick<GenerateState, 'catalog' | 'maxTextureSize'>>): void => {
      const next = { ...get(), ...patch };
      const { provider, modelId } = next;
      // A chosen model that the list lacks stays chosen (a saved choice survives a list that is still loading); it settles when it is listed.
      const settled = provider !== null && modelId !== null && findModel(next.catalog, provider, modelId) !== null ? settleSelection(next.catalog, next.maxTextureSize, provider, modelId, next) : {};
      set({ ...patch, atlasKey: settleAtlasKey(next.atlasKey, next.maxTextureSize), ...settled });
    };
    return {
      prompt: '',
      references: [],
      channel: 'albedo',
      ...NO_SELECTION,
      atlasKey: DEFAULT_ATLAS_KEY,
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
      enhancedPrompt: null,
      atlasPreview: null,
      notice: null,
      unwrap: IDLE_UNWRAP,
      setPrompt: (prompt) => set({ prompt }),
      restoreSettings: (settings) => {
        set(settings);
        resettle({});
      },
      setNotice: (notice) => set({ notice }),
      addReferences: (images) => {
        const { references, catalog, provider, modelId } = get();
        const known = new Set(references.map((reference) => reference.id));
        const fresh = images.filter((image, index) => !known.has(image.id) && images.findIndex((other) => other.id === image.id) === index);
        const room = Math.max(0, referenceCap(findModel(catalog, provider, modelId)) - references.length);
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
      setQuality: (level) => {
        const { catalog, provider, modelId, maxTextureSize } = get();
        const info = findModel(catalog, provider, modelId);
        if (info !== null && optionsForModel(info, maxTextureSize).qualityLevels.includes(level)) set({ quality: level });
      },
      setCatalog: (catalog) => resettle({ catalog }),
      setHasKey: (provider, has) => set({ hasKey: { ...get().hasKey, [provider]: has } }),
      setEnhancer: (enhancer) => set({ enhancer }),
      setMaxTextureSize: (maxTextureSize) => resettle({ maxTextureSize }),
      setSceneState: ({ hasModel, hasUvs, readOnly = false, setOpen = false, setBusy = false }) => set({ hasModel, hasUvs, readOnly, setOpen, setBusy }),
      beginRun: () => set({ status: 'running', step: 'capture', fraction: 0, error: null, enhancedPrompt: null, atlasPreview: null, notice: null }),
      setStep: (step, fraction) => set({ step, fraction: clamp01(fraction) }),
      setEnhancedPrompt: (enhancedPrompt) => set({ enhancedPrompt }),
      setAtlasPreview: (atlasPreview) => set({ atlasPreview }),
      failRun: (error) => set({ status: 'failed', error, atlasPreview: null }),
      clearRun: () => set({ status: 'idle', step: null, fraction: 0, error: null, atlasPreview: null }),
      beginUnwrap: () => set({ unwrap: { status: 'running', fraction: 0, error: null } }),
      setUnwrapProgress: (fraction) => set({ unwrap: { ...get().unwrap, fraction: clamp01(fraction) } }),
      failUnwrap: (error) => set({ unwrap: { status: 'failed', fraction: 0, error } }),
      clearUnwrap: () => set({ unwrap: IDLE_UNWRAP }),
    };
  });
}

export const generateStore = createGenerateStore();
export const useGenerateStore = <T,>(selector: (state: GenerateState) => T): T => useStore(generateStore, selector);
