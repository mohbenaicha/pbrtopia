import type { MapKind } from './mapKinds';

// The stored shape of a material's maps (maps R7-R8). Storage keeps these inside the material record; this folder owns the rules over them.

export const MATERIAL_SIZES = [256, 512, 1024, 2048] as const;
export type MaterialSize = (typeof MATERIAL_SIZES)[number];

/** The kind and working key of the map a derived map was computed from (maps R5). */
export interface DerivedFromRecord {
  kind: MapKind;
  key: string;
}

/** The undo entry next to `undoKey` (maps R8). */
export interface MapUndoEntry {
  label: string;
  derivedFrom?: DerivedFromRecord; // the map's previous derivedFrom
  offsetBase?: string; // the map's previous offsetBase (masks R83)
  groupId?: string; // set only by a geometry operation
  size?: MaterialSize; // the previous S, only on the entries of an S change
}

/** Where a map's original came from, shown on its card (maps R44). */
export type MapSource = { kind: 'generated' } | { kind: 'computed' } | { kind: 'dropped'; name: string };

export interface MapRecord {
  originalKey: string;
  workingKey: string;
  undoKey: string | null;
  undo?: MapUndoEntry; // present exactly when undoKey is set
  width: number; // of the original
  height: number;
  derivedFrom?: DerivedFromRecord;
  /** Height only (masks R83): the key of the Height map this working copy was computed from by the height offsets; any other edit removes it. */
  offsetBase?: string;
  source?: MapSource;
}

export type MapRecords = Partial<Record<MapKind, MapRecord>>;

/** What the map rules read and write: S and the maps. Everything else in the material record is outside them. */
export interface MapsState {
  size: MaterialSize | null;
  maps: MapRecords;
}
