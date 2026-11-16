import type { JournalKind } from '../../gpu/createStampPainter';

/** Which maps of the picture exist, as far as a placement is concerned. */
export interface MapPresence { height: boolean; normal: boolean }

/**
 * Clone R14, R15: the journaled targets a placement changes. Colour and roughness+metal always (AO never); height only when the map exists; a normal map brings the
 * slope (cleared under the copy) and the override (the copied normal).
 */
export function placementKinds(present: MapPresence): JournalKind[] {
  const kinds: JournalKind[] = ['albedo', 'orm'];
  if (present.height) kinds.push('height');
  if (present.normal) kinds.push('slope', 'override');
  return kinds;
}
