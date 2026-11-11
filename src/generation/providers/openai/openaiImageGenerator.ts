import { checkRequestHasContent } from '../checkRequestHasContent';
import { classifyOkBody } from '../classifyProviderError';
import { decodeBase64ToBlob } from '../base64';
import type { ImageGenerator } from '../ImageGenerator';
import { sendProviderRequest, type ProviderRequest } from '../sendProviderRequest';
import { buildOpenAiGenerationBody, buildOpenAiImageForm, defaultComplexityOf, OPENAI_EDITS_URL, OPENAI_GENERATIONS_URL } from './openaiRequests';
import { parseOpenAiImage } from './openaiResponses';

// R7: the OpenAI image call: build the form, send once, read the answer. The key goes only into the Authorization header (R14); no
// content-type is set so the browser adds the multipart boundary.
export function createOpenAiImageGenerator(fetchImpl: typeof fetch = fetch): ImageGenerator {
  return {
    async generate(request, ctx) {
      const empty = checkRequestHasContent(request);
      if (empty !== null) return { ok: false, error: empty };
      const complexity = request.complexity ?? defaultComplexityOf(request.model);
      const settings = { ...request, ...(complexity === undefined ? {} : { complexity }) };
      const authorization = { Authorization: `Bearer ${ctx.apiKey}` };
      let outgoing: ProviderRequest;
      if (request.images.length === 0 && request.references.length === 0) {
        const body = buildOpenAiGenerationBody(settings);
        if (!body.ok) return body;
        outgoing = { provider: 'openai', url: OPENAI_GENERATIONS_URL, method: 'POST', headers: { ...authorization, 'content-type': 'application/json' }, body: JSON.stringify(body.value) };
      } else {
        const form = buildOpenAiImageForm(settings);
        if (!form.ok) return form;
        outgoing = { provider: 'openai', url: OPENAI_EDITS_URL, method: 'POST', headers: authorization, body: form.value };
      }
      const sent = await sendProviderRequest(outgoing, ctx, fetchImpl);
      if (!sent.ok) return sent;
      const reported = classifyOkBody(sent.value);
      if (reported !== null) return { ok: false, error: reported };
      const image = parseOpenAiImage(sent.value);
      if (!image.ok) return image;
      return { ok: true, value: { blob: decodeBase64ToBlob(image.value.base64, image.value.mimeType), mimeType: image.value.mimeType } };
    },
  };
}
