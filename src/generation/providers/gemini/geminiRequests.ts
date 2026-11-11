import { findGeminiAspectRatio, type Canvas } from '../../catalog/canvasRules';
import type { ResolutionKey } from '../../catalog/modelTypes';
import type { EncodedImage } from '../base64';
import { makeProviderError } from '../classifyProviderError';
import type { ProviderError, Result } from '../providerTypes';

export const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
export const INLINE_LIMIT_BYTES = 20 * 1024 * 1024;
const GEMINI_SIZES: ReadonlySet<ResolutionKey> = new Set<ResolutionKey>(['1K', '2K', '4K']);

type GeminiPart = { type: 'text'; text: string } | { type: 'image'; mime_type: string; data: string };

interface GeminiImageBody {
  model: string;
  input: GeminiPart[];
  response_format: { type: 'image'; mime_type: 'image/jpeg'; aspect_ratio: string; image_size: string };
  generation_config?: { thinking_level: string };
}

interface GeminiEnhanceBody {
  model: string;
  input: GeminiPart[];
  generation_config?: { thinking_level: string };
}

const imagePart = (image: EncodedImage): GeminiPart => ({ type: 'image', mime_type: image.mimeType, data: image.base64 });

// R7: the Interactions body for one image: prompt, images, references. The output is a JPEG (the only format the API offers) and a
// square unless a canvas is given (custom R12), because without an aspect ratio the answer is 1408x768. A size or a canvas shape Gemini
// has no name for is refused here, before anything is sent.
export function buildGeminiImageBody(input: { model: string; prompt: string; resolutionKey: ResolutionKey; quality: string | null; images: EncodedImage[]; canvas?: Canvas }): Result<GeminiImageBody, ProviderError> {
  if (!GEMINI_SIZES.has(input.resolutionKey)) return { ok: false, error: makeProviderError('bad-request') };
  const aspectRatio = input.canvas === undefined ? '1:1' : findGeminiAspectRatio(input.canvas);
  if (aspectRatio === undefined) return { ok: false, error: makeProviderError('bad-request') };
  return {
    ok: true,
    value: {
      model: input.model,
      input: [{ type: 'text', text: input.prompt }, ...input.images.map(imagePart)],
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: aspectRatio, image_size: input.resolutionKey },
      ...(input.quality === null ? {} : { generation_config: { thinking_level: input.quality } }),
    },
  };
}

// R8: the enhancer body: the fixed instruction with the user's prompt, then the image, and the thinking level when the model's table row has one.
export function buildGeminiEnhanceBody(input: { model: string; prompt: string; image?: EncodedImage; level: string | null }): GeminiEnhanceBody {
  return {
    model: input.model,
    input: input.image === undefined ? [{ type: 'text', text: input.prompt }] : [{ type: 'text', text: input.prompt }, imagePart(input.image)],
    ...(input.level === null ? {} : { generation_config: { thinking_level: input.level } }),
  };
}

// R7: images go inline as base64 (a third larger than the bytes); the request must stay under 20 MiB. Null when it fits.
export function checkInlineSize(images: Blob[], prompt: string): ProviderError | null {
  const total = images.reduce((sum, image) => sum + Math.ceil((image.size * 4) / 3), prompt.length);
  if (total < INLINE_LIMIT_BYTES) return null;
  return { ...makeProviderError('bad-request'), message: 'The images are too big for this model: lower the resolution or remove references' };
}
