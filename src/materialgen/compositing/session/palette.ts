import type { BaseMaterial } from '@mat/masks';
import type { PaintMaterial } from '../gpu/paintMaterial';
import { SQUARE_SHAPE, type ShapeSlot } from '../plan/planStamps';

type ShapeTriple<T> = readonly [T, T, T];

/**
 * Compositing R5, R8, R57: the three shape slots (each empty or a shape with its Invert), which of them are active (the brush draws only from active, filled
 * ones; an empty slot is never active), and the one material; session-only.
 */
export interface Palette {
  shapes: ShapeTriple<ShapeSlot | null>;
  active: ShapeTriple<boolean>;
  material: BaseMaterial | null;
}

export type ShapeSlotNumber = 0 | 1 | 2;

export const EMPTY_PALETTE: Palette = { shapes: [null, null, null], active: [false, false, false], material: null };

const replaceAt = <T>(triple: ShapeTriple<T>, slot: ShapeSlotNumber, value: T): ShapeTriple<T> => {
  const copy: [T, T, T] = [triple[0], triple[1], triple[2]];
  copy[slot] = value;
  return copy;
};

const withShape = (palette: Palette, slot: ShapeSlotNumber, value: ShapeSlot | null): Palette => ({ ...palette, shapes: replaceAt(palette.shapes, slot, value) });

/** R6, R57: fills an empty slot with a shape that starts active and not inverted. */
export const setShape = (palette: Palette, slot: ShapeSlotNumber, index: number): Palette => ({
  ...withShape(palette, slot, { index, invert: false }),
  active: replaceAt(palette.active, slot, true),
});

/**
 * R5a, R57: removing a shape clears its Invert and its active mark; when that leaves shapes but none active, the first remaining shape (slot order) becomes active.
 */
export const removeShape = (palette: Palette, slot: ShapeSlotNumber): Palette => {
  const shapes = replaceAt(palette.shapes, slot, null);
  let active = replaceAt(palette.active, slot, false);
  if (!active.some(Boolean)) {
    const first = shapes.findIndex((shape) => shape !== null);
    if (first >= 0) active = replaceAt(active, first as ShapeSlotNumber, true);
  }
  return { ...palette, shapes, active };
};

/** R57: flips a filled shape between active and inactive; an empty slot, and the only active shape, stay as they are (one shape is always active). */
export const toggleActive = (palette: Palette, slot: ShapeSlotNumber): Palette => {
  if (palette.shapes[slot] === null) return palette;
  if (palette.active[slot] && palette.active.filter(Boolean).length === 1) return palette;
  return { ...palette, active: replaceAt(palette.active, slot, !palette.active[slot]) };
};

/** R5a: swaps black and white of a filled slot; an empty slot has nothing to swap. */
export const toggleInvert = (palette: Palette, slot: ShapeSlotNumber): Palette => {
  const current = palette.shapes[slot];
  return current === null ? palette : withShape(palette, slot, { index: current.index, invert: !current.invert });
};

export const setMaterial = (palette: Palette, material: BaseMaterial): Palette => ({ ...palette, material });
export const removeMaterial = (palette: Palette): Palette => ({ ...palette, material: null });

const SQUARE_SLOT: ShapeSlot = { index: SQUARE_SHAPE, invert: false };

/** R11, R57, R43: the active shapes the brush chooses among, in slot order; with every slot empty, the plain square. */
export const shapeSlotsOf = (palette: Palette): ShapeSlot[] => {
  const chosen = palette.shapes.filter((slot, index): slot is ShapeSlot => slot !== null && palette.active[index] === true);
  return chosen.length > 0 ? chosen : [SQUARE_SLOT];
};

/** R42: what an empty Material slot paints: grey 128, roughness 1, metalness 0. */
export const DEFAULT_PAINT_MATERIAL: PaintMaterial = { albedo: [128, 128, 128], roughness: 255, metalness: 0 };

/** R17, R42: the table's unit roughness and metal as the bytes the painter writes; the default material when none is chosen. */
export const paintMaterialOf = (material: BaseMaterial | null): PaintMaterial =>
  material === null ? DEFAULT_PAINT_MATERIAL : { albedo: material.rgb, roughness: Math.round(material.roughness * 255), metalness: Math.round(material.metal * 255) };
