import { dropUndoEntries } from './mapOperations';
import type { MapKind } from './mapKinds';
import type { MapsState } from './mapRecord';
import { kindLabel, type ColorModeName } from './ui/buildCardModel';

export interface MissingFilesReport {
  /** The record after the entries of unreadable undo files are dropped; the same object when nothing changes. */
  state: MapsState;
  /** One "<name>: file missing" line per map with a missing file, in map order. */
  lines: string[];
}

/**
 * Maps R30: what to do when the record names files the store does not have. The slot shows "Missing file" by itself and Restore original stays
 * (the keys are kept); an unreadable undo file makes that map's Undo unavailable, with the other live members of its group (R70).
 */
export function reportMissingFiles(state: MapsState, missingKeys: readonly string[], colorMode: ColorModeName): MissingFilesReport {
  if (missingKeys.length === 0) return { state, lines: [] };
  const missing = new Set(missingKeys);
  const lines: string[] = [];
  const unreadableUndo: MapKind[] = [];
  for (const kind of Object.keys(state.maps) as MapKind[]) {
    const map = state.maps[kind]!;
    if ([map.originalKey, map.workingKey, map.undoKey].some((key) => key !== null && missing.has(key))) lines.push(`${kindLabel(kind, colorMode)}: file missing`);
    if (map.undoKey !== null && missing.has(map.undoKey)) unreadableUndo.push(kind);
  }
  return { state: dropUndoEntries(state, unreadableUndo), lines };
}
