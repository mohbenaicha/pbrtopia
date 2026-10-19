import type { ResolutionKey } from '../catalog/modelTypes';
import type { CallContext, ProviderError, Result } from './providerTypes';

export interface GenerateRequest {
  model: string;
  prompt: string; // the enhanced prompt
  atlas: Blob; // the captured atlas, always first
  references: Blob[];
  resolutionKey: ResolutionKey;
  sizePx: number; // the square side the key stands for
  quality: string | null; // the provider's own level; null when the model has none
}

export interface GeneratedImage {
  blob: Blob;
  mimeType: string;
}

// R7: one image request. Never throws for provider or network failures.
export interface ImageGenerator {
  generate(request: GenerateRequest, ctx: CallContext): Promise<Result<GeneratedImage, ProviderError>>;
}
