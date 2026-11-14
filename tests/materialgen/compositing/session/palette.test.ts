import { describe, expect, it } from 'vitest';
import { EMPTY_PALETTE, canPaint, paintMaterialOf, removeMaterial, removeShape, setMaterial, setShape, shapeSlotsOf, toggleInvert } from '../../../../src/materialgen/compositing/session/palette';

const steel = { name: 'Steel', roughness: 0.4, metal: 1, rgb: [200, 100, 50] as const };

describe('materialgen/compositing palette (R5 R5a R6 R8)', () => {
  it('R5 painting needs one to three shapes and a material; otherwise the panel says so', () => {
    expect(canPaint(EMPTY_PALETTE)).toBe(false);
    expect(canPaint(setShape(EMPTY_PALETTE, 0, 7))).toBe(false);
    expect(canPaint(setMaterial(setShape(EMPTY_PALETTE, 0, 7), steel))).toBe(true);
    expect(canPaint(setMaterial(EMPTY_PALETTE, steel))).toBe(false);
  });

  it('R11 the shapes the brush draws from are the filled slots in order, with their Invert', () => {
    const palette = toggleInvert(setShape(setShape(EMPTY_PALETTE, 2, 30), 0, 5), 2);
    expect(shapeSlotsOf(palette)).toEqual([{ index: 5, invert: false }, { index: 30, invert: true }]);
  });

  it('R6 replacing a shape keeps the slot\'s Invert', () => {
    const palette = setShape(toggleInvert(setShape(EMPTY_PALETTE, 1, 4), 1), 1, 9);
    expect(palette.shapes[1]).toEqual({ index: 9, invert: true });
  });

  it('R5a removing a shape clears its Invert, so a new shape in that slot starts not inverted', () => {
    const palette = setShape(removeShape(toggleInvert(setShape(EMPTY_PALETTE, 0, 4), 0), 0), 0, 6);
    expect(palette.shapes[0]).toEqual({ index: 6, invert: false });
  });

  it('R5a Invert of an empty slot does nothing, and a second press swaps back', () => {
    expect(toggleInvert(EMPTY_PALETTE, 1)).toEqual(EMPTY_PALETTE);
    const twice = toggleInvert(toggleInvert(setShape(EMPTY_PALETTE, 0, 3), 0), 0);
    expect(twice.shapes[0]).toEqual({ index: 3, invert: false });
  });

  it('R17 the material becomes the bytes the painter stores', () => {
    expect(paintMaterialOf(steel)).toEqual({ albedo: [200, 100, 50], roughness: 102, metalness: 255 });
    expect(paintMaterialOf(removeMaterial(setMaterial(EMPTY_PALETTE, steel)).material)).toBeNull();
  });
});
