import type { MapsState } from '@mat/maps';
import { listPlannedMaps } from '../plan/editPlan';
import type { GenerationPlan } from '../plan/planTypes';
import type { ColorModeName } from '../prompts/buildMapPrompt';
import { mapDisplayName, mapKindOf } from './buildJobs';

/**
 * Generation R61: the names of the maps in the plan that already have an original, which Generate would replace; empty for a first generation. A map not in the plan is
 * not touched. The decomposition card replaces the Metal-Roughness labels when it is included.
 */
export function listMapsToReplace(plan: GenerationPlan, state: Pick<MapsState, 'maps'>, colorMode: ColorModeName): string[] {
  const names = listPlannedMaps(plan).filter((map) => state.maps[mapKindOf(map, colorMode)] !== undefined).map((map) => mapDisplayName(map, colorMode));
  if (plan.decomposition !== null && state.maps.labels !== undefined) names.push('Metal-Roughness');
  return names;
}

/** R61: the confirm text, or null when nothing would be replaced (no dialog for a first generation or a Retry). */
export function describeRegenerateWarning(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  return `Generating replaces the originals of ${names.join(', ')} and clears the undo of those maps. Maps you edited are replaced too.`;
}
