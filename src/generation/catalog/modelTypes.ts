import type { Provider } from '../../keys';

export type ResolutionKey = '1K' | '2K' | '2.8K' | '4K';

export interface ResolutionOption {
  key: ResolutionKey;
  sizePx: number; // the square atlas side
}

// What the app knows about one model. `verified` is true when the id is in the shipped table; an unverified model offers no sizes or levels.
export interface ModelInfo {
  provider: Provider;
  id: string;
  role: 'image' | 'vision-text';
  displayName: string;
  verified: boolean;
  resolutions: ResolutionOption[];
  qualityLevels: string[]; // the provider's own names, in the order to show
  defaultQuality?: string; // one of qualityLevels; absent when there are none
  maxReferenceImages?: number; // images in total including the atlas
  timeoutMs?: number;
  experimentalResolutions?: ResolutionKey[]; // sizes the provider documents as experimental
  retiring?: { shutdownDate: string }; // YYYY-MM-DD
}

// A shipped table row: a verified model, dated, with where the facts came from.
export interface KnownModelEntry extends ModelInfo {
  verifiedAt: string; // YYYY-MM-DD
  source: string[];
}

export interface ModelOptions {
  resolutions: ResolutionOption[];
  qualityLevels: string[];
}
