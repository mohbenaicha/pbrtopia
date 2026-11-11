import type { MapKind } from './mapKinds';
import { MATERIAL_SIZES, type DerivedFromRecord, type MapRecord, type MapRecords, type MapSource, type MapUndoEntry, type MapsState, type MaterialSize } from './mapRecord';

// The rules of maps R7-R26 and R70 as pure functions over MapsState. They take the keys of blobs already written and return the next state;
// the caller writes the blobs first, commits the record, then deletes the keys the new state no longer references (R29).

/** R15: the allowed size nearest to a longer side by ratio; a tie goes to the smaller size. */
export function nearestMaterialSize(longerSide: number): MaterialSize {
  let best: MaterialSize = MATERIAL_SIZES[0];
  let bestRatio = Infinity;
  for (const size of MATERIAL_SIZES) {
    const ratio = Math.max(longerSide / size, size / longerSide);
    if (ratio < bestRatio) {
      best = size;
      bestRatio = ratio;
    }
  }
  return best;
}

/** Every blob key the maps name, once each (R25, R28). */
export function referencedMapKeys(state: MapsState): Set<string> {
  const keys = new Set<string>();
  for (const map of Object.values(state.maps)) {
    keys.add(map.originalKey);
    keys.add(map.workingKey);
    if (map.undoKey !== null) keys.add(map.undoKey);
  }
  return keys;
}

const kindsOf = (maps: MapRecords): MapKind[] => Object.keys(maps) as MapKind[];

function withoutUndo(map: MapRecord): MapRecord {
  const next: MapRecord = { ...map, undoKey: null };
  delete next.undo;
  return next;
}

function withDerivedFrom(map: MapRecord, derivedFrom: DerivedFromRecord | undefined): MapRecord {
  const next: MapRecord = { ...map };
  if (derivedFrom === undefined) delete next.derivedFrom;
  else next.derivedFrom = derivedFrom;
  return next;
}

/** R70: every map whose entry carries one of these group ids loses its entry (its undo blob is no longer referenced). */
function breakGroups(maps: MapRecords, groupIds: ReadonlySet<string>): MapRecords {
  if (groupIds.size === 0) return maps;
  const next: MapRecords = {};
  for (const kind of kindsOf(maps)) {
    const map = maps[kind]!;
    const id = map.undo?.groupId;
    next[kind] = id !== undefined && groupIds.has(id) ? withoutUndo(map) : map;
  }
  return next;
}

function groupIdOf(map: MapRecord | undefined): string | undefined {
  return map?.undo?.groupId;
}

export interface PlacedMap {
  originalKey: string;
  /** The same key as `originalKey` when the image is already S x S in the slot format (R12). */
  workingKey: string;
  width: number;
  height: number;
  derivedFrom?: DerivedFromRecord;
  source?: MapSource;
}

/**
 * R12-R15, R22: a generated, dropped or computed image becomes the map's original (a place, or a regenerate over an existing map).
 * The map's own undo is cleared and its group broken; a place into an empty slot also breaks the group of an S change (R70).
 * S is set from the image when it is unset (R15).
 */
export function placeMap(state: MapsState, kind: MapKind, image: PlacedMap): MapsState {
  const existing = state.maps[kind];
  const broken = new Set<string>();
  const ownGroup = groupIdOf(existing);
  if (ownGroup !== undefined) broken.add(ownGroup);
  if (existing === undefined) {
    for (const map of Object.values(state.maps)) if (map.undo?.size !== undefined && map.undo.groupId !== undefined) broken.add(map.undo.groupId);
  }
  const record: MapRecord = { originalKey: image.originalKey, workingKey: image.workingKey, undoKey: null, width: image.width, height: image.height };
  if (image.derivedFrom !== undefined) record.derivedFrom = image.derivedFrom;
  if (image.source !== undefined) record.source = image.source;
  return {
    size: state.size ?? nearestMaterialSize(Math.max(image.width, image.height)),
    maps: breakGroups({ ...state.maps, [kind]: record }, broken),
  };
}

export interface MapEdit {
  kind: MapKind;
  workingKey: string;
  /** Left out: unchanged. A record: the new source. `null`: removed (a dropped image has no source, R33). */
  derivedFrom?: DerivedFromRecord | null;
}

export interface EditGroup {
  groupId: string;
  /** The previous S, only for a change of S (R21). */
  size?: MaterialSize;
}

/**
 * R16: each touched map gets a new working key and its own undo entry holding the previous one (replacing its old entry as a whole).
 * The groups of the entries it replaces are broken; a geometry operation passes `group` to tie its entries together (R70).
 */
export function editMaps(state: MapsState, edits: readonly MapEdit[], label: string, group?: EditGroup): MapsState {
  const maps: MapRecords = { ...state.maps };
  const replaced = new Set<string>();
  for (const edit of edits) {
    const previous = maps[edit.kind];
    if (previous === undefined) throw new Error(`There is no ${edit.kind} map to edit`);
    const oldGroup = groupIdOf(previous);
    if (oldGroup !== undefined && oldGroup !== group?.groupId) replaced.add(oldGroup);
    const entry: MapUndoEntry = { label };
    if (previous.derivedFrom !== undefined) entry.derivedFrom = previous.derivedFrom;
    if (group !== undefined) {
      entry.groupId = group.groupId;
      if (group.size !== undefined) entry.size = group.size;
    }
    const source = edit.derivedFrom === undefined ? previous.derivedFrom : edit.derivedFrom === null ? undefined : edit.derivedFrom;
    maps[edit.kind] = withDerivedFrom({ ...previous, workingKey: edit.workingKey, undoKey: previous.workingKey, undo: entry }, source);
  }
  return { size: state.size, maps: breakGroups(maps, replaced) };
}

/** R19: the working map becomes the original again. Pass `resampledKey` when the original is not S x S; nothing changes when it already is the working map. */
export function restoreOriginal(state: MapsState, kind: MapKind, resampledKey?: string): MapsState {
  const map = state.maps[kind];
  if (map === undefined || map.workingKey === map.originalKey) return state;
  return editMaps(state, [{ kind, workingKey: resampledKey ?? map.originalKey }], 'Restore original');
}

/** R18, R47, R70: the maps one Undo press changes: the asked maps that have an entry plus every live member of their groups. */
export function undoTargets(state: MapsState, kinds: readonly MapKind[]): MapKind[] {
  const targets = new Set<MapKind>();
  const groups = new Set<string>();
  for (const kind of kinds) {
    const entry = state.maps[kind]?.undo;
    if (entry === undefined) continue;
    targets.add(kind);
    if (entry.groupId !== undefined) groups.add(entry.groupId);
  }
  if (groups.size > 0) for (const kind of kindsOf(state.maps)) if (groups.has(groupIdOf(state.maps[kind]) ?? '')) targets.add(kind);
  return [...targets];
}

export function canUndo(state: MapsState, kind: MapKind): boolean {
  return state.maps[kind]?.undo !== undefined;
}

/** R18: every target gets its previous working key and derivedFrom back, and its entry is gone; undoing an S change returns S. */
export function undoMaps(state: MapsState, kinds: readonly MapKind[]): MapsState {
  const targets = undoTargets(state, kinds);
  if (targets.length === 0) return state;
  const maps: MapRecords = { ...state.maps };
  let size = state.size;
  for (const kind of targets) {
    const map = maps[kind]!;
    const entry = map.undo!;
    if (entry.size !== undefined) size = entry.size;
    maps[kind] = withDerivedFrom({ ...withoutUndo(map), workingKey: map.undoKey! }, entry.derivedFrom);
  }
  return { size, maps };
}

/** R30, R70: these maps lose their undo entry, and so does every live member of their groups (the undo files are no longer referenced). */
export function dropUndoEntries(state: MapsState, kinds: readonly MapKind[]): MapsState {
  const groups = new Set<string>();
  const dropped = new Set<MapKind>();
  for (const kind of kinds) {
    const map = state.maps[kind];
    if (map?.undo === undefined) continue;
    dropped.add(kind);
    if (map.undo.groupId !== undefined) groups.add(map.undo.groupId);
  }
  if (dropped.size === 0) return state;
  const maps = breakGroups(state.maps, groups);
  for (const kind of dropped) maps[kind] = withoutUndo(maps[kind]!);
  return { size: state.size, maps };
}

/** R20: the map and its three keys go; its group is broken; clearing the last map unsets S. */
export function clearMap(state: MapsState, kind: MapKind): MapsState {
  const map = state.maps[kind];
  if (map === undefined) return state;
  const rest: MapRecords = { ...state.maps };
  delete rest[kind];
  const group = groupIdOf(map);
  const maps = breakGroups(rest, group === undefined ? new Set() : new Set([group]));
  return { size: kindsOf(maps).length === 0 ? null : state.size, maps };
}

/** R32: a derived map is stale when the current working key of its source differs from the key it was computed from, or the source is gone. */
export function isStale(state: MapsState, kind: MapKind): boolean {
  const source = state.maps[kind]?.derivedFrom;
  return source !== undefined && state.maps[source.kind]?.workingKey !== source.key;
}

/**
 * R21: a change of S. `workingKeys` holds the new S x S blob of every map (labels included, which gets no undo entry, R6).
 * One group ties the entries and records the previous S; fresh derived maps follow their sources' new keys and stale ones stay stale.
 */
export function changeSize(state: MapsState, size: MaterialSize, workingKeys: Partial<Record<MapKind, string>>, groupId: string): MapsState {
  if (state.size === size) return state;
  const kinds = kindsOf(state.maps);
  if (kinds.length === 0) return { size, maps: {} };
  const fresh = new Set(kinds.filter((kind) => state.maps[kind]!.derivedFrom !== undefined && !isStale(state, kind)));
  const replaced = new Set<string>();
  const maps: MapRecords = {};
  for (const kind of kinds) {
    const map = state.maps[kind]!;
    const key = workingKeys[kind];
    if (key === undefined) throw new Error(`The resampled ${kind} map is missing`);
    const source = map.derivedFrom;
    const remapped = source !== undefined && fresh.has(kind) ? { kind: source.kind, key: workingKeys[source.kind] ?? source.key } : source;
    const oldGroup = groupIdOf(map);
    if (oldGroup !== undefined) replaced.add(oldGroup);
    if (kind === 'labels') {
      maps[kind] = withDerivedFrom({ ...map, workingKey: key }, remapped);
      continue;
    }
    const entry: MapUndoEntry = { label: 'Change size', groupId, size: state.size! };
    if (source !== undefined) entry.derivedFrom = source;
    maps[kind] = withDerivedFrom({ ...map, workingKey: key, undoKey: map.workingKey, undo: entry }, remapped);
  }
  return { size, maps: breakGroups(maps, replaced) };
}

/** R24-R26: what must hold after every committed operation, as plain lines; empty when it does. */
export function checkMapsInvariants(state: MapsState): string[] {
  const problems: string[] = [];
  const kinds = kindsOf(state.maps);
  if (kinds.length > 0 && (state.size === null || !MATERIAL_SIZES.includes(state.size))) problems.push(`size ${state.size} is not an allowed size`);
  const sizesByGroup = new Map<string, Set<MaterialSize | undefined>>();
  for (const kind of kinds) {
    const map = state.maps[kind]!;
    if (map.undoKey !== null && map.undo === undefined) problems.push(`${kind}: undoKey is set without an undo entry`);
    if (map.undoKey === null && map.undo !== undefined) problems.push(`${kind}: an undo entry exists without an undoKey`);
    if (kind === 'labels' && (map.undoKey !== null || map.undo !== undefined)) problems.push('labels: never has an undo entry');
    const id = map.undo?.groupId;
    if (id !== undefined) sizesByGroup.set(id, (sizesByGroup.get(id) ?? new Set()).add(map.undo!.size));
  }
  for (const [id, sizes] of sizesByGroup) if (sizes.size > 1) problems.push(`group ${id}: members disagree about the previous size`);
  return problems;
}
