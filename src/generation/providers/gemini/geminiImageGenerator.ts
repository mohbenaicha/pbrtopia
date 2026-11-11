import { checkRequestHasContent } from '../checkRequestHasContent';
import { classifyOkBody } from '../classifyProviderError';
import { decodeBase64ToBlob, encodeImage } from '../base64';
import type { ImageGenerator } from '../ImageGenerator';
import { sendProviderRequest } from '../sendProviderRequest';
import { checkInlineSize, buildGeminiImageBody, GEMINI_INTERACTIONS_URL } from './geminiRequests';
import { parseGeminiImage } from './geminiResponses';

// R7: the Gemini image call: build, send once, read the answer. The key goes only into the x-goog-api-key header (R14).
export function createGeminiImageGenerator(fetchImpl: typeof fetch = fetch): ImageGenerator {
  return {
    async generate(request, ctx) {
      const empty = checkRequestHasContent(request);
      if (empty !== null) return { ok: false, error: empty };
      const attached = [...request.images, ...request.references];
      const tooBig = checkInlineSize(attached, request.prompt);
      if (tooBig !== null) return { ok: false, error: tooBig };
      const images = await Promise.all(attached.map(encodeImage));
      const body = buildGeminiImageBody({ model: request.model, prompt: request.prompt, resolutionKey: request.resolutionKey, quality: request.quality, images, ...(request.canvas ? { canvas: request.canvas } : {}) });
      if (!body.ok) return body;
      const sent = await sendProviderRequest(
        { provider: 'gemini', url: GEMINI_INTERACTIONS_URL, method: 'POST', headers: { 'x-goog-api-key': ctx.apiKey, 'content-type': 'application/json' }, body: JSON.stringify(body.value) },
        ctx,
        fetchImpl,
      );
      if (!sent.ok) return sent;
      const reported = classifyOkBody(sent.value);
      if (reported !== null) return { ok: false, error: reported };
      const image = parseGeminiImage(sent.value);
      if (!image.ok) return image;
      return { ok: true, value: { blob: decodeBase64ToBlob(image.value.base64, image.value.mimeType), mimeType: image.value.mimeType } };
    },
  };
}
