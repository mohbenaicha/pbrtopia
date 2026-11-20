import { checkRequestHasContent } from '../checkRequestHasContent';
import { decodeBase64ToBlob, encodeImage } from '../base64';
import { classifyOkBody, makeProviderError } from '../classifyProviderError';
import type { ImageGenerator } from '../ImageGenerator';
import { sendProviderRequest } from '../sendProviderRequest';
import type { OpenRouterModelPlugin } from './openrouterModelPlugin';
import { buildOpenRouterBody, OPENROUTER_IMAGES_URL } from './openrouterRequests';
import { parseOpenRouterImage } from './openrouterResponses';
import { findOpenRouterPlugin, OPENROUTER_MODELS } from './registry';

// R45: the OpenRouter image call: find the model's plug-in, build the body, send once, read the answer. The key goes only into the
// Authorization header (R14). A model with no plug-in is refused before anything is sent (R44).
export function createOpenRouterImageGenerator(fetchImpl: typeof fetch = fetch, plugins: readonly OpenRouterModelPlugin[] = OPENROUTER_MODELS): ImageGenerator {
  return {
    async generate(request, ctx) {
      const empty = checkRequestHasContent(request);
      if (empty !== null) return { ok: false, error: empty };
      const plugin = findOpenRouterPlugin(request.model, plugins);
      if (plugin === null) return { ok: false, error: makeProviderError('bad-request') };
      const images = await Promise.all([...request.images, ...request.references].map(encodeImage));
      const body = buildOpenRouterBody({ prompt: request.prompt, resolutionKey: request.resolutionKey, images, ...(request.canvas ? { canvas: request.canvas } : {}) }, plugin);
      if (!body.ok) return body;
      const sent = await sendProviderRequest(
        { provider: 'openrouter', url: OPENROUTER_IMAGES_URL, method: 'POST', headers: { Authorization: `Bearer ${ctx.apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify(body.value) },
        ctx,
        fetchImpl,
      );
      if (!sent.ok) return sent;
      const reported = classifyOkBody(sent.value);
      if (reported !== null) return { ok: false, error: reported };
      const image = parseOpenRouterImage(sent.value);
      if (!image.ok) return image;
      const { base64, mimeType, costUsd } = image.value;
      return { ok: true, value: { blob: decodeBase64ToBlob(base64, mimeType), mimeType, ...(costUsd === undefined ? {} : { costUsd }) } };
    },
  };
}
