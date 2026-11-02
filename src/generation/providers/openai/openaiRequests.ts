import { isOpenAiCanvas, type Canvas } from '../../catalog/canvasRules';
import type { ResolutionKey } from '../../catalog/modelTypes';
import type { EncodedImage } from '../base64';
import { makeProviderError } from '../classifyProviderError';
import type { ProviderError, Result } from '../providerTypes';

export const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits';
export const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
// Not seen live (no OpenAI key at the time of the live check): the documented repeated field name.
export const IMAGE_FIELD = 'image[]';
// Not seen live: OpenAI has no 4K square; 2K and 2.8K are the documented multiples of 16.
const OPENAI_SIZES: ReadonlySet<ResolutionKey> = new Set<ResolutionKey>(['1K', '2K', '2.8K']);

type OpenAiPart = { type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail: 'auto' };

interface OpenAiEnhanceBody {
  model: string;
  input: { role: 'user'; content: OpenAiPart[] }[];
  reasoning?: { effort: string };
}

const extensionOf = (blob: Blob): string => (blob.type.startsWith('image/') && blob.type.length > 6 ? blob.type.slice(6) : 'png');

// R7: the multipart form for one image edit: model, prompt, size (square, or the canvas of custom R12), quality (left out when the model
// has none), a PNG output, then the atlas and the references under the image field. A size or canvas OpenAI has no name for is refused
// here, before anything is sent.
export function buildOpenAiImageForm(input: { model: string; prompt: string; resolutionKey: ResolutionKey; sizePx: number; quality: string | null; atlas: Blob; references: Blob[]; canvas?: Canvas }): Result<FormData, ProviderError> {
  if (!OPENAI_SIZES.has(input.resolutionKey)) return { ok: false, error: makeProviderError('bad-request') };
  if (input.canvas !== undefined && !isOpenAiCanvas(input.canvas)) return { ok: false, error: makeProviderError('bad-request') };
  const form = new FormData();
  form.append('model', input.model);
  form.append('prompt', input.prompt);
  form.append('size', input.canvas === undefined ? `${input.sizePx}x${input.sizePx}` : `${input.canvas.width}x${input.canvas.height}`);
  if (input.quality !== null) form.append('quality', input.quality);
  form.append('output_format', 'png');
  form.append(IMAGE_FIELD, new File([input.atlas], 'atlas.png', { type: 'image/png' }));
  input.references.forEach((reference, index) => {
    form.append(IMAGE_FIELD, new File([reference], `reference-${index + 1}.${extensionOf(reference)}`, { type: reference.type === '' ? 'image/png' : reference.type }));
  });
  return { ok: true, value: form };
}

// R8: the Responses body for the prompt enhancer: one user message with the instruction text and the atlas as a data URL, and the
// reasoning effort when the model's table row has one.
export function buildOpenAiEnhanceBody(input: { model: string; prompt: string; atlas: EncodedImage; level: string | null }): OpenAiEnhanceBody {
  return {
    model: input.model,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: input.prompt },
          { type: 'input_image', image_url: `data:${input.atlas.mimeType};base64,${input.atlas.base64}`, detail: 'auto' },
        ],
      },
    ],
    ...(input.level === null ? {} : { reasoning: { effort: input.level } }),
  };
}
