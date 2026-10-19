import { classifyOkBody } from '../classifyProviderError';
import { encodeImage } from '../base64';
import type { PromptEnhancer } from '../PromptEnhancer';
import { sendProviderRequest } from '../sendProviderRequest';
import { buildGeminiEnhanceBody, GEMINI_INTERACTIONS_URL } from './geminiRequests';
import { parseGeminiText } from './geminiResponses';

// R8: the Gemini prompt enhancer: the chosen text model reads the prompt and the atlas and answers with the rewritten prompt.
export function createGeminiPromptEnhancer(fetchImpl: typeof fetch = fetch): PromptEnhancer {
  return {
    async enhance(request, ctx) {
      const atlas = await encodeImage(request.atlas);
      const body = buildGeminiEnhanceBody({ model: request.model, prompt: request.prompt, atlas });
      const sent = await sendProviderRequest(
        { provider: 'gemini', url: GEMINI_INTERACTIONS_URL, method: 'POST', headers: { 'x-goog-api-key': ctx.apiKey, 'content-type': 'application/json' }, body: JSON.stringify(body) },
        ctx,
        fetchImpl,
      );
      if (!sent.ok) return sent;
      const reported = classifyOkBody(sent.value);
      if (reported !== null) return { ok: false, error: reported };
      return parseGeminiText(sent.value);
    },
  };
}
