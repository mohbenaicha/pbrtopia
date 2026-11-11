import type { PlanReport } from '../plan/inspectPlan';
import { gridName } from '../layout/chooseLayout';
import { buildJobs } from '../run/buildJobs';
import type { ColorModeName } from '../prompts/buildMapPrompt';
import { estimateImageCost } from './estimateImageCost';

export interface CostRow {
  label: string; // "Image 2 (Normal)", "Describe step"
  model: string;
  canvas: string; // "2048 x 1024", "" for the describe step
  layout: string; // "2x1"
  tilePx: number | null;
  costText: string; // "about $0.03", "price unknown", "under $0.01"
}

export interface CostHint {
  summary: string; // R62: "4 images - maps 1024 px - about $0.19"
  rows: CostRow[];
  notices: string[]; // R64
}

const formatUsd = (value: number): string => (value < 0.01 ? 'under $0.01' : `$${value.toFixed(2)}`);

/**
 * Generation R62-R64: the one-line hint under Generate and its rows, from the plan alone. It calls no provider and never blocks Generate. `describeModel` names the text
 * model of the describe step (its price is small and left out of the total).
 */
export function buildCostHint(report: PlanReport, colorMode: ColorModeName, materialSize: number | null, describeModel: string | null): CostHint {
  const jobs = buildJobs(report, colorMode);
  const rows: CostRow[] = [];
  let total = 0;
  let unknown = 0;
  for (const job of jobs) {
    const cost = estimateImageCost({ modelId: job.settings.modelId, resolutionKey: job.settings.resolutionKey, quality: job.settings.quality, canvas: job.layout.canvas });
    if (cost === null) unknown += 1;
    else total += cost;
    rows.push({
      label: job.label,
      model: job.settings.modelId,
      canvas: `${job.layout.canvas.width} x ${job.layout.canvas.height}`,
      layout: gridName(job.layout.grid),
      tilePx: job.layout.tileSide,
      costText: cost === null ? 'price unknown' : `about ${formatUsd(cost)}`,
    });
  }
  if (jobs.some((job) => job.kind === 'decomposition')) {
    rows.push({ label: 'Describe step', model: describeModel ?? 'not chosen', canvas: '', layout: '', tilePx: null, costText: 'under $0.01' });
  }

  const lead = jobs.find((job) => job.position === 1);
  const mapPx = materialSize ?? lead?.layout.tileSide ?? null;
  const priced = jobs.length - unknown;
  const totalText = jobs.length === 0 || priced === 0 ? 'price unknown' : `${unknown > 0 ? 'at least' : 'about'} ${formatUsd(total)}`;
  const parts = [`${jobs.length} image${jobs.length === 1 ? '' : 's'}`, ...(mapPx === null ? [] : [`maps ${mapPx} px`]), totalText];

  const notices: string[] = [];
  const smallest = jobs.filter((job) => job.kind === 'map').map((job) => job.layout.tileSide).sort((a, b) => a - b)[0];
  if (materialSize !== null && smallest !== undefined && smallest < materialSize) notices.push(`tiles ${smallest} px, maps scaled to ${materialSize}`);
  if (jobs.some((job) => job.kind === 'map' && job.maps.length > 1 && job.settings.provider === 'gemini')) notices.push('JPEG output');
  return { summary: parts.join(' - '), rows, notices };
}
