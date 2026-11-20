// Custom generation R12: which canvases (width x height) an image model can return at a resolution key. The tile-fit geometry is the
// engine's (fitSheet); this file only lists the shapes. Facts come from research/api/providers.md.

export interface Canvas {
  width: number;
  height: number;
}

export interface PixelBudget {
  minPixels: number;
  maxPixels: number;
  step: number; // both sides are multiples of this
  maxRatio: number; // long side / short side
  maxEdge: number;
}

export type CanvasRule =
  | { kind: 'list'; byResolution: Record<string, Canvas[]> }
  | { kind: 'budget'; byResolution: Record<string, PixelBudget> };

// Aspects offered by a budget rule besides the ideal one: portrait to landscape, extremes first and last.
const BUDGET_ASPECTS = [1 / 3, 1 / 2, 9 / 16, 2 / 3, 3 / 4, 1, 4 / 3, 3 / 2, 16 / 9, 2, 3];

// The documented Gemini aspect ratios (width:height); the long side of a canvas is the resolution key's size.
const GEMINI_RATIOS: [number, number][] = [[1, 1], [3, 2], [2, 3], [3, 4], [4, 3], [4, 5], [5, 4], [9, 16], [16, 9], [21, 9]];

// Aspect ratios as [width, height] pairs, both orientations listed.
export type RatioList = readonly (readonly [number, number])[];

// The ratio ("w:h") a canvas has in `ratios`, within 1%; undefined when the list has none, so the request is refused.
export function findAspectRatio(canvas: Canvas, ratios: RatioList): string | undefined {
  const aspect = canvas.width / canvas.height;
  const match = ratios.find(([w, h]) => Math.abs(aspect / (w / h) - 1) <= 0.01);
  return match ? `${match[0]}:${match[1]}` : undefined;
}

// The documented Gemini ratio ("w:h") a canvas has, within 1%; undefined when the canvas has none, so the request is refused.
export const findGeminiAspectRatio = (canvas: Canvas): string | undefined => findAspectRatio(canvas, GEMINI_RATIOS);

// The documented limits of an OpenAI image size (research/api/providers.md 1.3): sides multiples of 16, aspect between 1:3 and 3:1,
// no edge over 3840, 655,360 to 8,294,400 pixels.
export function isOpenAiCanvas(canvas: Canvas): boolean {
  const { width, height } = canvas;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return false;
  const pixels = width * height;
  return width % 16 === 0 && height % 16 === 0 && Math.max(width, height) <= 3840 && Math.max(width, height) / Math.min(width, height) <= 3 && pixels >= 655_360 && pixels <= 8_294_400;
}

// A list rule for a provider that takes an aspect ratio and a size key: one canvas per ratio with the long side at `longSidePx`.
export function buildRatioListRule(longSideByKey: Record<string, number>, ratios: RatioList = GEMINI_RATIOS): CanvasRule {
  const byResolution: Record<string, Canvas[]> = {};
  for (const [key, longSide] of Object.entries(longSideByKey)) {
    byResolution[key] = ratios.map(([w, h]) => (w >= h ? { width: longSide, height: Math.round((longSide * h) / w) } : { width: Math.round((longSide * w) / h), height: longSide }));
  }
  return { kind: 'list', byResolution };
}

export function listCanvases(rule: CanvasRule, resolutionKey: string, idealAspect?: number): Canvas[] {
  if (rule.kind === 'list') return (rule.byResolution[resolutionKey] ?? []).map((canvas) => ({ ...canvas }));
  const budget = rule.byResolution[resolutionKey];
  if (!budget) return [];
  const aspects = idealAspect !== undefined && Number.isFinite(idealAspect) && idealAspect > 0 ? [...BUDGET_ASPECTS, clampAspect(idealAspect, budget.maxRatio)] : BUDGET_ASPECTS;
  const seen = new Set<string>();
  const canvases: Canvas[] = [];
  for (const aspect of aspects) {
    const canvas = fitBudget(budget, aspect);
    if (!canvas) continue;
    const id = `${canvas.width}x${canvas.height}`;
    if (seen.has(id)) continue;
    seen.add(id);
    canvases.push(canvas);
  }
  return canvases;
}

function clampAspect(aspect: number, maxRatio: number): number {
  return Math.min(maxRatio, Math.max(1 / maxRatio, aspect));
}

// The largest pair near `aspect` (width / height) with both sides rounded down to the step; null when a cap is not met.
function fitBudget(budget: PixelBudget, aspect: number): Canvas | null {
  if (aspect > budget.maxRatio + 1e-9 || aspect < 1 / budget.maxRatio - 1e-9) return null;
  const floorToStep = (value: number) => Math.floor(value / budget.step + 1e-9) * budget.step;
  let width = floorToStep(Math.sqrt(budget.maxPixels * aspect));
  let height = floorToStep(Math.sqrt(budget.maxPixels / aspect));
  // Rounding the short side up in ratio can push the pair just past the ratio cap: pull the long side back.
  if (width > height && width / height > budget.maxRatio) width = floorToStep(height * budget.maxRatio);
  if (height > width && height / width > budget.maxRatio) height = floorToStep(width * budget.maxRatio);
  const pixels = width * height;
  if (width <= 0 || height <= 0 || pixels > budget.maxPixels || pixels < budget.minPixels) return null;
  if (Math.max(width, height) > budget.maxEdge) return null;
  if (Math.max(width, height) / Math.min(width, height) > budget.maxRatio + 1e-9) return null;
  return { width, height };
}
