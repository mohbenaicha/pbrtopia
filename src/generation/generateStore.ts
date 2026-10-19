import { createStore, useStore } from 'zustand';
import type { Provider } from '../keys';
import { chooseQualityLevel, optionsForModel } from './catalog/optionsForModel';
import type { ModelInfo, ResolutionKey } from './catalog/modelTypes';
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
export type ModelCatalog = Record<Provider, ModelInfo[]>;
export interface EnhancerChoice {
  provider: Provider;
  modelId: string;
}

export interface GenerateState {
  prompt: string;
  references: ReferenceImage[];
  channel: 'albedo';
  provider: Provider | null;
  modelId: string | null;
  resolutionKey: ResolutionKey | null;
  quality: string | null;
  // fed by app/
  catalog: ModelCatalog;
  hasKey: Record<Provider, boolean>;
  enhancer: EnhancerChoice | null;
  maxTextureSize: number;
  hasModel: boolean;
  hasUvs: boolean;
  // run state
  status: RunStatus;
  step: RunStep | null;
  fraction: number;
  error: RunError | null;
  enhancedPrompt: string | null;
  setPrompt: (prompt: string) => void;
  addReferences: (images: ReferenceImage[]) => { added: number; refused: number };
  removeReference: (id: string) => void;
  selectModel: (provider: Provider, modelId: string) => void;
  setResolution: (key: ResolutionKey) => void;
  setQuality: (level: string) => void;
  setCatalog: (catalog: ModelCatalog) => void;
  setHasKey: (provider: Provider, has: boolean) => void;
  setEnhancer: (enhancer: EnhancerChoice | null) => void;
  setMaxTextureSize: (size: number) => void;
  setSceneState: (scene: { hasModel: boolean; hasUvs: boolean }) => void;
  beginRun: () => void;
  setStep: (step: RunStep, fraction: number) => void;
  setEnhancedPrompt: (text: string | null) => void;
  failRun: (error: RunError) => void;
  clearRun: () => void;
}

type Selection = Pick<GenerateState, 'provider' | 'modelId' | 'resolutionKey' | 'quality'>;
const NO_SELECTION: Selection = { provider: null, modelId: null, resolutionKey: null, quality: null };

export const findCatalogModel = (catalog: ModelCatalog, provider: Provider | null, modelId: string | null): ModelInfo | null =>
  provider === null || modelId === null ? null : (catalog[provider].find((model) => model.id === modelId) ?? null);
const findModel = findCatalogModel;

// R4, R5: the size and level for a model: the current ones when the model offers them, else 2K, else the first size; else the model's default level.
function settleSelection(catalog: ModelCatalog, maxTextureSize: number, provider: Provider, modelId: string, current: Selection): Selection {
  const info = findModel(catalog, provider, modelId);
  if (info === null) return NO_SELECTION;
  const { resolutions } = optionsForModel(info, maxTextureSize);
  const keys = resolutions.map((option) => option.key);
  const resolutionKey = current.resolutionKey !== null && keys.includes(current.resolutionKey) ? current.resolutionKey : keys.includes('2K') ? '2K' : (keys[0] ?? null);
  return { provider, modelId, resolutionKey, quality: chooseQualityLevel(info, current.quality ?? '') };
}

const referenceCap = (info: ModelInfo | null): number => (info?.maxReferenceImages === undefined ? Infinity : Math.max(0, info.maxReferenceImages - 1));
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function createGenerateStore() {
  return createStore<GenerateState>()((set, get) => {
    const resettle = (patch: Partial<Pick<GenerateState, 'catalog' | 'maxTextureSize'>>): void => {
      const next = { ...get(), ...patch };
      const { provider, modelId } = next;
      set({ ...patch, ...(provider === null || modelId === null ? {} : settleSelection(next.catalog, next.maxTextureSize, provider, modelId, next)) });
    };
    return {
      prompt: '',
      references: [],
      channel: 'albedo',
      ...NO_SELECTION,
      catalog: { gemini: [], openai: [] },
      hasKey: { gemini: false, openai: false },
      enhancer: null,
      maxTextureSize: 0,
      hasModel: false,
      hasUvs: false,
      status: 'idle',
      step: null,
      fraction: 0,
      error: null,
      enhancedPrompt: null,
      setPrompt: (prompt) => set({ prompt }),
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
      setQuality: (level) => {
        const { catalog, provider, modelId, maxTextureSize } = get();
        const info = findModel(catalog, provider, modelId);
        if (info !== null && optionsForModel(info, maxTextureSize).qualityLevels.includes(level)) set({ quality: level });
      },
      setCatalog: (catalog) => {
        const { provider, modelId } = get();
        if (findModel(catalog, provider, modelId) === null) set({ catalog, ...NO_SELECTION });
        else resettle({ catalog });
      },
      setHasKey: (provider, has) => set({ hasKey: { ...get().hasKey, [provider]: has } }),
      setEnhancer: (enhancer) => set({ enhancer }),
      setMaxTextureSize: (maxTextureSize) => resettle({ maxTextureSize }),
      setSceneState: ({ hasModel, hasUvs }) => set({ hasModel, hasUvs }),
      beginRun: () => set({ status: 'running', step: 'capture', fraction: 0, error: null, enhancedPrompt: null }),
      setStep: (step, fraction) => set({ step, fraction: clamp01(fraction) }),
      setEnhancedPrompt: (enhancedPrompt) => set({ enhancedPrompt }),
      failRun: (error) => set({ status: 'failed', error }),
      clearRun: () => set({ status: 'idle', step: null, fraction: 0, error: null }),
    };
  });
}

export const generateStore = createGenerateStore();
export const useGenerateStore = <T,>(selector: (state: GenerateState) => T): T => useStore(generateStore, selector);
