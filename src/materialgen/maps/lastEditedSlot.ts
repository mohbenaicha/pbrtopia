import { MAP_KINDS, slotOfKind, type Slot } from './mapKinds';
import type { MapsState } from './mapRecord';

/**
 * Materialgen app R47: the slot whose map was edited between two states, i.e. whose working file changed and now has an undo entry; null when nothing was.
 * An undo removes the entry, so it names no slot and the last edited card stays as it was.
 */
export function findEditedSlot(before: MapsState, after: MapsState): Slot | null {
  for (const kind of MAP_KINDS) {
    const now = after.maps[kind];
    if (now?.undo === undefined) continue;
    const was = before.maps[kind];
    if (was !== undefined && was.workingKey === now.workingKey && was.undoKey === now.undoKey) continue;
    return slotOfKind(kind); // an edit across several maps (a group) names the first changed slot in card order; its Undo reverts the whole group
  }
  return null;
}
