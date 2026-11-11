import type { CallContext, ProviderError, Result } from './providerTypes';

interface EnhanceRequest {
  model: string; // the Settings enhancer model
  prompt: string;
  image?: Blob; // the picture the enhancer is shown; without one the request is text-only (materialgen generation R72)
  level: string | null; // the model's reasoning effort or thinking level from the model table; null sends none
}

// R8: rewrites the user's prompt with the image in view. Never throws for provider or network failures.
export interface PromptEnhancer {
  enhance(request: EnhanceRequest, ctx: CallContext): Promise<Result<string, ProviderError>>;
}
