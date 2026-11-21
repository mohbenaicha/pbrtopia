import type { MapKind } from '@mat/maps';
import { gridName } from '../layout/chooseLayout';
import type { PlanReport } from '../plan/inspectPlan';
import type { ColorModeName } from '../prompts/buildMapPrompt';
import { labelImage } from '../split/splitReturnedImage';
import type { PlanMap } from '../plan/planTypes';
import type { ImageJob } from './runTypes';

/** The name the person sees for a planned map: Albedo is Diffuse in the Diffuse colour mode (R32). */
export const mapDisplayName = (map: PlanMap, colorMode: ColorModeName): string => (map === 'albedo' ? (colorMode === 'diffuse' ? 'Diffuse' : 'Albedo') : 'Height');

/** The map kind a planned map is stored as: the colour slot holds albedo or diffuse by the project's colour mode. */
export const mapKindOf = (map: PlanMap, colorMode: ColorModeName): MapKind => (map === 'albedo' ? colorMode : map);

export const DECOMPOSITION_LABEL = 'Metal-Roughness image';

/** The layout of a job in words for the log: "2x1". */
export const describeLayout = (job: ImageJob): string => gridName(job.layout.grid);

/**
 * R6, R7: the calls a plan makes, in order: the map images that hold a map (Image 1 first), then the decomposition image. A card with a problem has no layout
 * and is not a job; the caller has already refused to run such a plan (R9).
 */
export function buildJobs(report: PlanReport, colorMode: ColorModeName): ImageJob[] {
  const jobs: ImageJob[] = [];
  for (const card of report.cards) {
    if (card.layout?.ok !== true || card.model === null) continue;
    const sizePx = card.model.resolutions.find((option) => option.key === card.settings.resolutionKey)?.sizePx ?? 1024;
    if (card.card === 'decomposition') {
      jobs.push({ id: 'decomposition', kind: 'decomposition', position: 4, maps: [], settings: card.settings, layout: card.layout.layout, sizePx, label: DECOMPOSITION_LABEL });
    } else if (card.maps.length > 0) {
      const position = card.card + 1;
      jobs.push({ id: `image-${position}`, kind: 'map', position, maps: card.maps, settings: card.settings, layout: card.layout.layout, sizePx, label: labelImage(position, card.maps.map((map) => mapDisplayName(map, colorMode))) });
    }
  }
  return jobs;
}
