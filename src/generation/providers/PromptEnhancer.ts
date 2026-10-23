import type { CallContext, ProviderError, Result } from './providerTypes';

interface EnhanceRequest {
  model: string; // the Settings enhancer model
  prompt: string;
  atlas: Blob;
}

// R8: rewrites the user's prompt with the atlas in view. Never throws for provider or network failures.
export interface PromptEnhancer {
  enhance(request: EnhanceRequest, ctx: CallContext): Promise<Result<string, ProviderError>>;
}
