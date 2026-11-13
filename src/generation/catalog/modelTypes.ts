import type { Provider } from '../../keys';
import type { CanvasRule } from './canvasRules';

export type ResolutionKey = '1K' | '2K' | '2.8K' | '4K';

export interface ResolutionOption {
  key: ResolutionKey;
  sizePx: number; // the square atlas side
}

// What the app knows about one model. `verified` is true when the id is in the shipped table; an unverified model offers no sizes or levels.
export interface ProviderModelRecord {
  provider: Provider;
  id: string;
  role: 'image' | 'vision-text';
  displayName: string;
  verified: boolean;
  resolutions: ResolutionOption[];
  qualityLevels: string[]; // the provider's own names, in the order to show
  defaultQuality?: string; // one of qualityLevels; absent when there are none
  defaultComplexity?: string; // OpenAI 2.6 image models: the `complexity` every request carries (low, medium or high); absent = the field is not sent; no UI control
  enhancerLevel?: string; // vision-text models: the reasoning effort (OpenAI) or thinking level (Gemini) the enhancer request carries; absent = provider default
  maxReferenceImages?: number; // images in total including the atlas
  timeoutMs?: number;
  experimentalResolutions?: ResolutionKey[]; // sizes the provider documents as experimental
  canvases?: CanvasRule; // custom generation R12: the shapes the model can return per resolution key (image models in the table)
  retiring?: { shutdownDate: string }; // YYYY-MM-DD
  deprecated?: boolean; // still listed, labelled "(deprecated)", but cannot be chosen (generate R4)
}

// A shipped table row: a verified model, dated, with where the facts came from.
export interface KnownModelEntry extends ProviderModelRecord {
  verifiedAt: string; // YYYY-MM-DD
  source: string[];
}

export interface ModelOptions {
  resolutions: ResolutionOption[];
  qualityLevels: string[];
}
