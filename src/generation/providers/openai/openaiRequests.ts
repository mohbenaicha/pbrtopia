import { isOpenAiCanvas, type Canvas } from '../../catalog/canvasRules';
import { findKnownModel } from '../../catalog/knownModels';
import type { ResolutionKey } from '../../catalog/modelTypes';
import type { EncodedImage } from '../base64';
import { makeProviderError } from '../classifyProviderError';
import type { ProviderError, Result } from '../providerTypes';

export const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits';
export const OPENAI_GENERATIONS_URL = 'https://api.openai.com/v1/images/generations';
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

// The 2.6 models plan before rendering; an omitted `complexity` means high for them (provider docs, 2026-11-06), so the app sends the table row's medium. Other models have no such field.
export function defaultComplexityOf(model: string): string | undefined {
  return findKnownModel('openai', model)?.defaultComplexity;
}

/** What both image endpoints are told besides the pictures. */
interface OpenAiImageSettings {
  model: string;
  prompt: string;
  resolutionKey: ResolutionKey;
  sizePx: number;
  quality: string | null;
  complexity?: string;
  canvas?: Canvas;
}

// The shared fields in a fixed order: model, prompt, size (square, or the canvas of custom R12), quality (left out when the model has
// none), complexity (2.6 models), a PNG output. A size or canvas OpenAI has no name for is refused here, before anything is sent.
function settingFields(input: OpenAiImageSettings): Result<Record<string, string>, ProviderError> {
  if (!OPENAI_SIZES.has(input.resolutionKey)) return { ok: false, error: makeProviderError('bad-request') };
  if (input.canvas !== undefined && !isOpenAiCanvas(input.canvas)) return { ok: false, error: makeProviderError('bad-request') };
  const fields: Record<string, string> = {
    model: input.model,
    prompt: input.prompt,
    size: input.canvas === undefined ? `${input.sizePx}x${input.sizePx}` : `${input.canvas.width}x${input.canvas.height}`,
  };
  if (input.quality !== null) fields['quality'] = input.quality;
  if (input.complexity !== undefined) fields['complexity'] = input.complexity;
  fields['output_format'] = 'png';
  fields['moderation'] = 'low';
  return { ok: true, value: fields };
}

// R17: the JSON body of a text-to-image call (no picture to edit), with the same settings as the edit form.
export function buildOpenAiGenerationBody(input: OpenAiImageSettings): Result<Record<string, string>, ProviderError> {
  return settingFields(input);
}

const extensionOf =(blob: Blob): string => (blob.type.startsWith('image/') && blob.type.length > 6 ? blob.type.slice(6) : 'png');

// R7: the multipart form for one image edit: model, prompt, size (square, or the canvas of custom R12), quality (left out when the model
// has none), a PNG output, then the atlas and the references under the image field. A size or canvas OpenAI has no name for is refused
// here, before anything is sent.
export function buildOpenAiImageForm(input: OpenAiImageSettings & { images: Blob[]; references: Blob[] }): Result<FormData, ProviderError> {
  const fields = settingFields(input);
  if (!fields.ok) return fields;
  const form = new FormData();
  for (const [name, value] of Object.entries(fields.value)) form.append(name, value);
  input.images.forEach((image, index) => {
    form.append(IMAGE_FIELD, new File([image], `image-${index + 1}.${extensionOf(image)}`, { type: image.type === '' ? 'image/png' : image.type }));
  });
  input.references.forEach((reference, index) => {
    form.append(IMAGE_FIELD, new File([reference], `reference-${index + 1}.${extensionOf(reference)}`, { type: reference.type === '' ? 'image/png' : reference.type }));
  });
  return { ok: true, value: form };
}

// R8: the Responses body for the prompt enhancer: one user message with the instruction text and the atlas as a data URL, and the
// reasoning effort when the model's table row has one.
export function buildOpenAiEnhanceBody(input: { model: string; prompt: string; image?: EncodedImage; level: string | null }): OpenAiEnhanceBody {
  const content: OpenAiPart[] = [{ type: 'input_text', text: input.prompt }];
  if (input.image !== undefined) content.push({ type: 'input_image', image_url: `data:${input.image.mimeType};base64,${input.image.base64}`, detail: 'auto' });
  return {
    model: input.model,
    input: [{ role: 'user', content }],
    ...(input.level === null ? {} : { reasoning: { effort: input.level } }),
  };
}
