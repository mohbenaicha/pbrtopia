import type { BaseMaterial } from '@mat/masks';
import type { PaintMaterial } from '../gpu/paintMaterial';
import type { ShapeSlot } from '../plan/planStamps';

/** Compositing R5, R8: the three shape slots (each empty or a shape with its Invert) and the one material; session-only. */
export interface Palette {
  shapes: readonly [ShapeSlot | null, ShapeSlot | null, ShapeSlot | null];
  material: BaseMaterial | null;
}

export type ShapeSlotNumber = 0 | 1 | 2;

export const EMPTY_PALETTE: Palette = { shapes: [null, null, null], material: null };

const withShape = (palette: Palette, slot: ShapeSlotNumber, value: ShapeSlot | null): Palette => {
  const shapes: [ShapeSlot | null, ShapeSlot | null, ShapeSlot | null] = [palette.shapes[0], palette.shapes[1], palette.shapes[2]];
  shapes[slot] = value;
  return { ...palette, shapes };
};

/** R6: fills or replaces a slot; a replaced shape keeps the slot's Invert. */
export const setShape = (palette: Palette, slot: ShapeSlotNumber, index: number): Palette => withShape(palette, slot, { index, invert: palette.shapes[slot]?.invert ?? false });

/** R5a: removing a shape clears its Invert with it. */
export const removeShape = (palette: Palette, slot: ShapeSlotNumber): Palette => withShape(palette, slot, null);

/** R5a: swaps black and white of a filled slot; an empty slot has nothing to swap. */
export const toggleInvert = (palette: Palette, slot: ShapeSlotNumber): Palette => {
  const current = palette.shapes[slot];
  return current === null ? palette : withShape(palette, slot, { index: current.index, invert: !current.invert });
};

export const setMaterial = (palette: Palette, material: BaseMaterial): Palette => ({ ...palette, material });
export const removeMaterial = (palette: Palette): Palette => ({ ...palette, material: null });

/** R11: the shapes the brush chooses among, in slot order. */
export const shapeSlotsOf = (palette: Palette): ShapeSlot[] => palette.shapes.filter((slot): slot is ShapeSlot => slot !== null);

/** R5: one to three shapes and a material are needed to paint. */
export const canPaint = (palette: Palette): boolean => shapeSlotsOf(palette).length > 0 && palette.material !== null;

/** R17: the table's unit roughness and metal as the bytes the painter writes. */
export const paintMaterialOf = (material: BaseMaterial | null): PaintMaterial | null =>
  material === null ? null : { albedo: material.rgb, roughness: Math.round(material.roughness * 255), metalness: Math.round(material.metal * 255) };
