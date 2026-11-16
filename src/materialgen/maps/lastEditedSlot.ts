import { MAP_KINDS, slotOfKind, type Slot } from './mapKinds';
import type { MapRecord, MapsState } from './mapRecord';

/** An undo gives a map its previous working file back, so the working key is now the key the undo entry named. */
const isUndoOf = (was: MapRecord, now: MapRecord): boolean => was.undoKey !== null && now.undo === undefined && now.workingKey === was.undoKey;

/**
 * Materialgen app R47: the slot whose map was edited between two states, i.e. whose working file changed, or which a generate, drop or place just made or replaced
 * (those have no undo entry, so Ctrl+Z then does nothing rather than undoing an older card); null when nothing was.
 * An undo names no slot and the last edited card stays as it was.
 */
export function findEditedSlot(before: MapsState, after: MapsState): Slot | null {
  for (const kind of MAP_KINDS) {
    const now = after.maps[kind];
    if (now === undefined) continue;
    const was = before.maps[kind];
    if (was !== undefined && was.workingKey === now.workingKey && was.undoKey === now.undoKey) continue;
    if (was !== undefined && isUndoOf(was, now)) continue;
    return slotOfKind(kind); // an edit across several maps (a group) names the first changed slot in card order; its Undo reverts the whole group
  }
  return null;
}
