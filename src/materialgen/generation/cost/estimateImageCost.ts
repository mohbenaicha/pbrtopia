import type { Canvas, ResolutionKey } from '@shared/generation';

/**
 * Generation R62, R63: what one image costs, in US dollars, from the prices read from the providers' pages (research/api/providers.md 1.7 and 4.4a, read 2026-11-06). These are
 * estimates for a hint, never billing. A model or setting with no price returns null.
 */

// Gemini: a price per image by resolution key.
const GEMINI_PER_IMAGE: Readonly<Record<string, Partial<Record<ResolutionKey, number>>>> = {
  'gemini-nano-banana-2.1': { '1K': 0.0336, '2K': 0.0504, '4K': 0.113 },
  'gemini-3.1-flash-image': { '1K': 0.067, '2K': 0.101, '4K': 0.151 },
  'gemini-3.1-flash-lite-image': { '1K': 0.0336 },
  'gemini-3-pro-image': { '1K': 0.134, '2K': 0.134, '4K': 0.24 },
};

// GPT Image: output tokens per image at $30 per million, at three square sizes (1024, 2048, 2880). The calculator shows no 2.6 price for max at 2880.
const SQUARE_PIXELS = [1024 * 1024, 2048 * 2048, 2880 * 2880] as const;
type TokenRow = readonly [number, number, number | null];
const OUTPUT_PRICE_PER_TOKEN = 30 / 1_000_000;

const SHARED_ROWS: Readonly<Record<string, TokenRow>> = { high: [1756, 3568, 5930], xhigh: [3122, 6343, 10542] };
const TOKENS_BY_FAMILY: Readonly<Record<'2.5' | '2.6', Readonly<Record<string, TokenRow>>>> = {
  '2.6': { low: [823, 1667, 2768], medium: [1449, 2944, 4894], ...SHARED_ROWS, max: [7024, 14272, null] },
  '2.5': { low: [196, 397, 659], medium: [439, 892, 1483], ...SHARED_ROWS, max: [7024, 14272, 23719] },
};

function familyOf(modelId: string): '2.5' | '2.6' | null {
  if (/^gpt-image-2\.6-/.test(modelId)) return '2.6';
  if (/^gpt-image-2\.5-/.test(modelId)) return '2.5';
  return null;
}

/** Log-log interpolation of tokens against pixels between the square sizes; below the first size tokens scale with pixels, above the last they continue the last segment. */
function interpolateTokens(row: readonly [number, number, number], pixels: number): number {
  if (pixels <= SQUARE_PIXELS[0]) return (row[0] * pixels) / SQUARE_PIXELS[0];
  const upper = pixels <= SQUARE_PIXELS[1] ? 1 : 2;
  const [p0, p1] = [SQUARE_PIXELS[upper - 1]!, SQUARE_PIXELS[upper]!];
  const slope = Math.log(row[upper]! / row[upper - 1]!) / Math.log(p1 / p0);
  return row[upper - 1]! * (pixels / p0) ** slope;
}

export interface PricedImage {
  modelId: string;
  resolutionKey: ResolutionKey;
  quality: string | null;
  canvas: Canvas;
}

export function estimateImageCost({ modelId, resolutionKey, quality, canvas }: PricedImage): number | null {
  const gemini = GEMINI_PER_IMAGE[modelId];
  if (gemini !== undefined) return gemini[resolutionKey] ?? null;
  const family = familyOf(modelId);
  if (family === null || quality === null) return null;
  const row = TOKENS_BY_FAMILY[family][quality];
  const pixels = canvas.width * canvas.height;
  if (row === undefined || (row[2] === null && pixels > SQUARE_PIXELS[1])) return null;
  return interpolateTokens([row[0], row[1], row[2] ?? row[1]], pixels) * OUTPUT_PRICE_PER_TOKEN;
}
