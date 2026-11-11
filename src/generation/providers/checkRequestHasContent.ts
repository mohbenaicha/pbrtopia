import { makeProviderError } from './classifyProviderError';
import type { GenerateRequest } from './ImageGenerator';
import type { ProviderError } from './providerTypes';

/** R17: a request with no prompt text and no picture at all cannot be sent; the adapter returns this instead of calling the network. */
export function checkRequestHasContent(request: Pick<GenerateRequest, 'prompt' | 'images' | 'references'>): ProviderError | null {
  if (request.prompt.trim() !== '' || request.images.length > 0 || request.references.length > 0) return null;
  return { ...makeProviderError('bad-request'), message: 'There is nothing to send: give a prompt or an image.' };
}
