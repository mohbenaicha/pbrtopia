import { findAspectRatio, type Canvas } from '../../catalog/canvasRules';
import type { ResolutionKey } from '../../catalog/modelTypes';
import type { EncodedImage } from '../base64';
import { makeProviderError } from '../classifyProviderError';
import type { ProviderError, Result } from '../providerTypes';
import type { OpenRouterModelPlugin } from './openrouterModelPlugin';

export const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images';
export const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key';

interface OpenRouterImageSettings {
  prompt: string;
  resolutionKey: ResolutionKey;
  images: EncodedImage[]; // the atlas first, then the references
  canvas?: Canvas;
}

const refused = (): Result<never, ProviderError> => ({ ok: false, error: makeProviderError('bad-request') });

// R45: the JSON body for one image call: model, prompt, the pictures as data URLs (left out when there is none), the plug-in's resolution value
// (left out when it has none) and the aspect ratio of the canvas ("1:1" for the square). Nothing else is sent. A canvas ratio the plug-in does
// not list, or a size it does not offer, is refused here, before anything is sent.
export function buildOpenRouterBody(input: OpenRouterImageSettings, plugin: OpenRouterModelPlugin): Result<Record<string, unknown>, ProviderError> {
  if (!plugin.row.resolutions.some((option) => option.key === input.resolutionKey)) return refused();
  const aspect = findAspectRatio(input.canvas ?? { width: 1, height: 1 }, plugin.wire.ratios); // the square atlas when there is no canvas
  if (aspect === undefined) return refused();
  const body: Record<string, unknown> = { model: plugin.row.id, prompt: input.prompt };
  if (input.images.length > 0) body['input_references'] = input.images.map((image) => ({ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } }));
  const resolution = plugin.wire.resolutionValues[input.resolutionKey];
  if (resolution !== undefined) body['resolution'] = resolution;
  body['aspect_ratio'] = aspect;
  return { ok: true, value: body };
}
