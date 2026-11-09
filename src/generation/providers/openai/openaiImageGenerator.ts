import { classifyOkBody } from '../classifyProviderError';
import { decodeBase64ToBlob } from '../base64';
import type { ImageGenerator } from '../ImageGenerator';
import { sendProviderRequest } from '../sendProviderRequest';
import { buildOpenAiImageForm, defaultComplexityOf, OPENAI_EDITS_URL } from './openaiRequests';
import { parseOpenAiImage } from './openaiResponses';

// R7: the OpenAI image call: build the form, send once, read the answer. The key goes only into the Authorization header (R14); no
// content-type is set so the browser adds the multipart boundary.
export function createOpenAiImageGenerator(fetchImpl: typeof fetch = fetch): ImageGenerator {
  return {
    async generate(request, ctx) {
      const complexity = request.complexity ?? defaultComplexityOf(request.model);
      const form = buildOpenAiImageForm({ ...request, ...(complexity === undefined ? {} : { complexity }) });
      if (!form.ok) return form;
      const sent = await sendProviderRequest(
        { provider: 'openai', url: OPENAI_EDITS_URL, method: 'POST', headers: { Authorization: `Bearer ${ctx.apiKey}` }, body: form.value },
        ctx,
        fetchImpl,
      );
      if (!sent.ok) return sent;
      const reported = classifyOkBody(sent.value);
      if (reported !== null) return { ok: false, error: reported };
      const image = parseOpenAiImage(sent.value);
      if (!image.ok) return image;
      return { ok: true, value: { blob: decodeBase64ToBlob(image.value.base64, image.value.mimeType), mimeType: image.value.mimeType } };
    },
  };
}
