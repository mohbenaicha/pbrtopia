import { classifyOkBody } from '../classifyProviderError';
import { encodeImage } from '../base64';
import type { PromptEnhancer } from '../PromptEnhancer';
import { sendProviderRequest } from '../sendProviderRequest';
import { buildOpenAiEnhanceBody, OPENAI_RESPONSES_URL } from './openaiRequests';
import { parseOpenAiText } from './openaiResponses';

// R8: the OpenAI prompt enhancer: the chosen text model reads the prompt and the image and answers with the rewritten prompt.
export function createOpenAiPromptEnhancer(fetchImpl: typeof fetch = fetch): PromptEnhancer {
  return {
    async enhance(request, ctx) {
      const image = request.image === undefined ? undefined : await encodeImage(request.image);
      const body = buildOpenAiEnhanceBody({ model: request.model, prompt: request.prompt, ...(image === undefined ? {} : { image }), level: request.level });
      const sent = await sendProviderRequest(
        { provider: 'openai', url: OPENAI_RESPONSES_URL, method: 'POST', headers: { Authorization: `Bearer ${ctx.apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify(body) },
        ctx,
        fetchImpl,
      );
      if (!sent.ok) return sent;
      const reported = classifyOkBody(sent.value);
      if (reported !== null) return { ok: false, error: reported };
      return parseOpenAiText(sent.value);
    },
  };
}
