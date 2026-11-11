import type { ColorMode } from '@mat/storage';
import { SLOTS, isShownAsCard, type Slot } from '@mat/maps';

/** Materialgen app R20, R20a: the slots that have a card, top to bottom (the decomposition slot has none). */
export const CARD_SLOTS: readonly Slot[] = SLOTS.filter(isShownAsCard);

const TITLES: Record<Exclude<Slot, 'color'>, string> = {
  normal: 'Normal',
  metalRoughness: 'Metal-Roughness',
  height: 'Height',
  occlusion: 'Occlusion',
  decomposition: 'Decomposition',
};

/** Materialgen app R16, R21: the card title; Color says Albedo or Diffuse by the colour mode. */
export function slotTitle(slot: Slot, colorMode: ColorMode): string {
  if (slot === 'color') return colorMode === 'albedo' ? 'Albedo' : 'Diffuse';
  return TITLES[slot];
}
