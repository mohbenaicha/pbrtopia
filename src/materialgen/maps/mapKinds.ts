// The fixed vocabulary of the material generator: six slots and the map kinds each slot holds.

export const SLOTS = ['color', 'normal', 'metalRoughness', 'height', 'occlusion', 'decomposition'] as const;
export type Slot = (typeof SLOTS)[number];

export const MAP_KINDS = ['albedo', 'diffuse', 'normal', 'rough', 'metal', 'height', 'ao', 'labels'] as const;
export type MapKind = (typeof MAP_KINDS)[number];

const KINDS_BY_SLOT: Readonly<Record<Slot, readonly MapKind[]>> = {
  color: ['albedo', 'diffuse'],
  normal: ['normal'],
  metalRoughness: ['rough', 'metal'],
  height: ['height'],
  occlusion: ['ao'],
  decomposition: ['labels'],
};

export function kindsOfSlot(slot: Slot): readonly MapKind[] {
  return KINDS_BY_SLOT[slot];
}

export function slotOfKind(kind: MapKind): Slot {
  const slot = SLOTS.find((candidate) => KINDS_BY_SLOT[candidate].includes(kind));
  if (!slot) throw new Error(`Map kind ${kind} belongs to no slot`);
  return slot;
}

/** Decomposition is a hidden slot: it has no card in the UI. */
export function isShownAsCard(slot: Slot): boolean {
  return slot !== 'decomposition';
}
