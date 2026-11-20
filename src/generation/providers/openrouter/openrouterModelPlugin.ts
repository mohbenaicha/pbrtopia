import { buildRatioListRule, type RatioList } from '../../catalog/canvasRules';
import type { KnownModelEntry, ResolutionKey } from '../../catalog/modelTypes';

// R44: everything the app knows about one OpenRouter model. A plug-in is a plain value: the generator, the key check and the model table
// read it and none of them names a model.
export interface OpenRouterModelPlugin {
  row: KnownModelEntry; // the model's table row (provider 'openrouter', role 'image', no quality levels)
  wire: {
    resolutionValues: Partial<Record<ResolutionKey, string>>; // the `resolution` field per key; empty = the field is not sent (R45)
    ratios: RatioList; // the `aspect_ratio` values the model lists
  };
}

const SIZE_PX: Partial<Record<ResolutionKey, number>> = { '1K': 1024, '2K': 2048, '4K': 4096 };
const OPENROUTER_DOCS = ['openrouter.ai model page and /api/v1/images/models/{slug}/endpoints', 'docs/api/openrouter-image-models.md'];

interface OpenRouterPluginSpec {
  id: string;
  displayName: string;
  verifiedAt: string; // YYYY-MM-DD
  resolutionValues: Partial<Record<ResolutionKey, string>>; // the sizes offered, with the field value each sends; {} offers 1K and sends none
  ratios: RatioList;
  maxReferenceImages: number; // input images in total, including the atlas
}

// R44, R47: the plug-in of a model from its documented facts: sizes limited to 1K, 2K and 4K, canvases from the ratio list, no quality levels.
export function buildOpenRouterPlugin(spec: OpenRouterPluginSpec): OpenRouterModelPlugin {
  const keys: ResolutionKey[] = Object.keys(spec.resolutionValues).length === 0 ? ['1K'] : (Object.keys(spec.resolutionValues) as ResolutionKey[]);
  const sizes = keys.map((key) => ({ key, sizePx: SIZE_PX[key] ?? 1024 }));
  return {
    row: {
      provider: 'openrouter',
      id: spec.id,
      role: 'image',
      displayName: spec.displayName,
      verified: true,
      resolutions: sizes,
      qualityLevels: [],
      maxReferenceImages: spec.maxReferenceImages,
      canvases: buildRatioListRule(Object.fromEntries(sizes.map((size) => [size.key, size.sizePx])), spec.ratios),
      verifiedAt: spec.verifiedAt,
      source: OPENROUTER_DOCS,
    },
    wire: { resolutionValues: spec.resolutionValues, ratios: spec.ratios },
  };
}
