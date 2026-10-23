import type { CallContext, ProviderError, Result } from './providerTypes';

interface EnhanceRequest {
  model: string; // the Settings enhancer model
  prompt: string;
  atlas: Blob;
  level: string | null; // the model's reasoning effort or thinking level from the model table; null sends none
}

// R8: rewrites the user's prompt with the atlas in view. Never throws for provider or network failures.
export interface PromptEnhancer {
  enhance(request: EnhanceRequest, ctx: CallContext): Promise<Result<string, ProviderError>>;
}
