import { describe, expect, it } from 'vitest';
import { DEFAULT_PAINT_MATERIAL, EMPTY_PALETTE, paintMaterialOf, removeMaterial, removeShape, setMaterial, setShape, shapeSlotsOf, toggleActive, toggleInvert } from '../../../../src/materialgen/compositing/session/palette';
import { SQUARE_SHAPE } from '../../../../src/materialgen/compositing/plan/planStamps';

const steel = { name: 'Steel', roughness: 0.4, metal: 1, rgb: [200, 100, 50] as const };

describe('materialgen/compositing palette (R5 R5a R6 R8)', () => {
  it('R43 with all three shape slots empty the brush is the square, whatever the material', () => {
    expect(shapeSlotsOf(EMPTY_PALETTE)).toEqual([{ index: SQUARE_SHAPE, invert: false }]);
    expect(shapeSlotsOf(setMaterial(EMPTY_PALETTE, steel))).toEqual([{ index: SQUARE_SHAPE, invert: false }]);
  });

  it('R43 a chosen shape replaces the square; removing it brings the square back', () => {
    const one = setShape(EMPTY_PALETTE, 1, 7);
    expect(shapeSlotsOf(one)).toEqual([{ index: 7, invert: false }]);
    expect(shapeSlotsOf(removeShape(one, 1))).toEqual([{ index: SQUARE_SHAPE, invert: false }]);
  });

  it('R42 an empty material paints grey 128, roughness 1, metalness 0; removing a material gives that back', () => {
    const grey = { albedo: [128, 128, 128], roughness: 255, metalness: 0 };
    expect(paintMaterialOf(null)).toEqual(grey);
    expect(paintMaterialOf(removeMaterial(setMaterial(EMPTY_PALETTE, steel)).material)).toEqual(grey);
    expect(DEFAULT_PAINT_MATERIAL).toEqual(grey);
  });

  it('R11 the shapes the brush draws from are the filled slots in order, with their Invert', () => {
    const palette = toggleInvert(setShape(setShape(EMPTY_PALETTE, 2, 30), 0, 5), 2);
    expect(shapeSlotsOf(palette)).toEqual([{ index: 5, invert: false }, { index: 30, invert: true }]);
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
  });
});

describe('materialgen/compositing palette, active shapes (R57 R11)', () => {
  it('R57 a shape added to an empty slot starts active, and shapeSlotsOf returns only the active ones in slot order', () => {
    const palette = setShape(setShape(setShape(EMPTY_PALETTE, 2, 30), 0, 5), 1, 9);
    expect(palette.active).toEqual([true, true, true]);
    const second = toggleActive(palette, 1);
    expect(second.active).toEqual([true, false, true]);
    expect(shapeSlotsOf(second)).toEqual([{ index: 5, invert: false }, { index: 30, invert: false }]);
  });

  it('R57 clicking the only active shape does nothing; clicking an inactive one adds it, up to all three', () => {
    const one = setShape(EMPTY_PALETTE, 1, 4);
    expect(toggleActive(one, 1)).toEqual(one);
    const two = toggleActive(setShape(one, 0, 6), 1);
    expect(two.active).toEqual([true, false, false]);
    expect(toggleActive(two, 1).active).toEqual([true, true, false]);
  });

  it('R57 an empty slot cannot be toggled', () => {
    expect(toggleActive(EMPTY_PALETTE, 1)).toEqual(EMPTY_PALETTE);
    const one = setShape(EMPTY_PALETTE, 0, 4);
    expect(toggleActive(one, 2)).toEqual(one);
  });

  it('R57 removing every active shape activates the first remaining one; removing an inactive one changes nothing else', () => {
    let palette = setShape(setShape(setShape(EMPTY_PALETTE, 0, 1), 1, 2), 2, 3);
    palette = toggleActive(toggleActive(palette, 0), 1); // only slot 2 active... slots 0, 1 off
    expect(palette.active).toEqual([false, false, true]);
    const removed = removeShape(palette, 2);
    expect(removed.active).toEqual([true, false, false]);
    expect(shapeSlotsOf(removed)).toEqual([{ index: 1, invert: false }]);
    expect(removeShape(toggleActive(setShape(setShape(EMPTY_PALETTE, 0, 1), 1, 2), 1), 1).active).toEqual([true, false, false]);
  });

  it('R57 R43 with no shape filled nothing is active and the brush is the square', () => {
    const emptied = removeShape(setShape(EMPTY_PALETTE, 1, 4), 1);
    expect(emptied.active).toEqual([false, false, false]);
    expect(shapeSlotsOf(emptied)).toEqual([{ index: SQUARE_SHAPE, invert: false }]);
  });

  it('R57 an inactive shape keeps its Invert, which can still be toggled', () => {
    const palette = toggleActive(setShape(setShape(EMPTY_PALETTE, 0, 1), 1, 2), 1);
    const inverted = toggleInvert(palette, 1);
    expect(inverted.shapes[1]).toEqual({ index: 2, invert: true });
    expect(inverted.active).toEqual([true, false, false]);
  });

  it('R57 R6 changing a shape is remove then add: the new one is active and not inverted', () => {
    const palette = toggleInvert(setShape(EMPTY_PALETTE, 0, 4), 0);
    const replaced = setShape(removeShape(palette, 0), 0, 8);
    expect(replaced.shapes[0]).toEqual({ index: 8, invert: false });
    expect(replaced.active).toEqual([true, false, false]);
  });
});
