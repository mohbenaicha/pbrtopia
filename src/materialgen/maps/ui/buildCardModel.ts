import { isStale, undoTargets } from '../mapOperations';
import { kindsOfSlot, type MapKind, type Slot } from '../mapKinds';
import type { MapRecords, MapsState } from '../mapRecord';

// What a slot card shows, worked out from the maps alone (maps R4, R32, R42, R44, R47). The card component only draws this.

export type ColorModeName = 'albedo' | 'diffuse';

export interface HalfModel {
  kind: MapKind;
  label: string;
  filled: boolean;
  workingKey: string | null;
  sizeText: string | null;
  sourceText: string | null;
  stale: boolean;
  canRestore: boolean;
}

export interface CardModel {
  slot: Slot;
  title: string;
  halves: HalfModel[];
  undo: { enabled: boolean; tooltip: string; kinds: MapKind[] };
}

const FIXED_LABELS: Record<Exclude<MapKind, 'albedo' | 'diffuse'>, string> = {
  normal: 'Normal',
  rough: 'Roughness',
  metal: 'Metal',
  height: 'Height',
  ao: 'Occlusion',
  labels: 'Decomposition',
};

/** R4: the Color slot keeps whichever kind holds its map (so toggling Albedo | Diffuse never moves a key); albedo when it is empty. */
export function colorKindOf(maps: MapRecords): 'albedo' | 'diffuse' {
  return maps.diffuse !== undefined && maps.albedo === undefined ? 'diffuse' : 'albedo';
}

/** R4, R44: a colour map is named by the colour mode; the others have fixed names. */
export function kindLabel(kind: MapKind, colorMode: ColorModeName): string {
  if (kind === 'albedo' || kind === 'diffuse') return colorMode === 'albedo' ? 'Albedo' : 'Diffuse';
  return FIXED_LABELS[kind];
}

const SLOT_TITLES: Record<Exclude<Slot, 'color'>, string> = {
  normal: 'Normal',
  metalRoughness: 'Metal-Roughness',
  height: 'Height',
  occlusion: 'Occlusion',
  decomposition: 'Decomposition',
};

function kindsOfCard(state: MapsState, slot: Slot): MapKind[] {
  return slot === 'color' ? [colorKindOf(state.maps)] : [...kindsOfSlot(slot)];
}

function sourceText(state: MapsState, kind: MapKind): string | null {
  const source = state.maps[kind]?.source;
  if (source === undefined) return null;
  if (source.kind === 'dropped') return `Dropped: ${source.name}`;
  return source.kind === 'generated' ? 'Generated' : 'Computed';
}

function describeHalf(state: MapsState, kind: MapKind, colorMode: ColorModeName): HalfModel {
  const map = state.maps[kind];
  return {
    kind,
    label: kindLabel(kind, colorMode),
    filled: map !== undefined,
    workingKey: map?.workingKey ?? null,
    sizeText: map === undefined || state.size === null ? null : `${state.size} x ${state.size}`,
    sourceText: sourceText(state, kind),
    stale: isStale(state, kind),
    canRestore: map !== undefined && map.workingKey !== map.originalKey,
  };
}

/** R47: "Undo <label> (<maps it changes>)": the card's maps with an entry plus the other live members of their groups. */
function describeUndo(state: MapsState, kinds: MapKind[], colorMode: ColorModeName): CardModel['undo'] {
  const targets = undoTargets(state, kinds);
  if (targets.length === 0) return { enabled: false, tooltip: 'Nothing to undo', kinds };
  const first = kinds.find((kind) => state.maps[kind]?.undo !== undefined) ?? targets[0]!;
  const label = state.maps[first]?.undo?.label ?? 'edit';
  const ordered = [...kinds.filter((kind) => targets.includes(kind)), ...targets.filter((kind) => !kinds.includes(kind))];
  return { enabled: true, tooltip: `Undo ${label} (${ordered.map((kind) => kindLabel(kind, colorMode)).join(', ')})`, kinds };
}

export function buildCardModel(state: MapsState, slot: Slot, colorMode: ColorModeName): CardModel {
  const kinds = kindsOfCard(state, slot);
  return {
    slot,
    title: slot === 'color' ? kindLabel('albedo', colorMode) : SLOT_TITLES[slot],
    halves: kinds.map((kind) => describeHalf(state, kind, colorMode)),
    undo: describeUndo(state, kinds, colorMode),
  };
}
