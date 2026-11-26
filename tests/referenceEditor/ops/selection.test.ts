import { describe, expect, it } from 'vitest';
import { createRaster } from '../../../src/referenceEditor/model/raster';
import { createSelectionMask, hasSelection, isSelected } from '../../../src/referenceEditor/model/selectionMask';
import { NO_RECORDER } from '../../../src/referenceEditor/model/writeRecorder';
import { packColour } from '../../../src/referenceEditor/model/packColour';
import { selectStroke } from '../../../src/referenceEditor/ops/selectStroke';
import { selectRect } from '../../../src/referenceEditor/ops/selectRect';
import { invertSelection } from '../../../src/referenceEditor/ops/invertSelection';
import { fillSelection } from '../../../src/referenceEditor/ops/fillSelection';
import { cropToSelection } from '../../../src/referenceEditor/ops/cropToSelection';
import { coveredSet } from '../bruteCoverage';

const W = 37; // not a multiple of 4: the invert tail and the padding are exercised
const H = 23;
const selectedIndexes = (mask: ReturnType<typeof createSelectionMask>): Set<number> => new Set([...Array(W * H).keys()].filter((index) => mask.cells[index] === 1));

describe('selectStroke (reference-editor R8)', () => {
  it('R8 a stroke selects exactly the covered pixels and sets exact bounds', () => {
    const mask = createSelectionMask(W, H);
    const a = { x: 6, y: 5 };
    const b = { x: 25, y: 15 };
    selectStroke(mask, { from: a, to: b, first: true }, 6, NO_RECORDER);
    expect(selectedIndexes(mask)).toEqual(coveredSet(a, b, 6, W, H));
    const xs = [...coveredSet(a, b, 6, W, H)].map((index) => index % W);
    const ys = [...coveredSet(a, b, 6, W, H)].map((index) => Math.floor(index / W));
    expect(mask.bounds).toEqual({ minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) });
  });

  it('R8 successive strokes only add, never remove', () => {
    const mask = createSelectionMask(W, H);
    selectStroke(mask, { from: { x: 3, y: 3 }, to: { x: 10, y: 3 }, first: true }, 4, NO_RECORDER);
    const first = selectedIndexes(mask);
    selectStroke(mask, { from: { x: 20, y: 18 }, to: { x: 30, y: 18 }, first: true }, 4, NO_RECORDER);
    for (const index of first) expect(mask.cells[index]).toBe(1);
    expect(selectedIndexes(mask).size).toBeGreaterThan(first.size);
  });

  it('R8 an empty mask has empty bounds and no selection', () => {
    const mask = createSelectionMask(W, H);
    expect(hasSelection(mask)).toBe(false);
    expect(mask.bounds.minX).toBeGreaterThan(mask.bounds.maxX);
  });
});

describe('selectRect (reference-editor R9)', () => {
  it('R9 selects the inclusive rectangle and reports it', () => {
    const mask = createSelectionMask(W, H);
    const rect = selectRect(mask, { x: 4, y: 3, w: 10, h: 6 }, NO_RECORDER);
    expect(rect).toEqual({ x: 4, y: 3, w: 10, h: 6 });
    expect(selectedIndexes(mask).size).toBe(60);
    expect(mask.bounds).toEqual({ minX: 4, minY: 3, maxX: 13, maxY: 8 });
  });

  it('R9 a rectangle partly outside the picture is clamped to it', () => {
    const mask = createSelectionMask(W, H);
    selectRect(mask, { x: -5, y: -5, w: 10, h: 10 }, NO_RECORDER);
    expect(selectedIndexes(mask).size).toBe(25);
    expect(mask.bounds).toEqual({ minX: 0, minY: 0, maxX: 4, maxY: 4 });
  });

  it('R9 a rectangle entirely outside changes nothing and returns null', () => {
    const mask = createSelectionMask(W, H);
    expect(selectRect(mask, { x: 100, y: 100, w: 5, h: 5 }, NO_RECORDER)).toBeNull();
    expect(hasSelection(mask)).toBe(false);
  });
});

describe('invertSelection (reference-editor R11)', () => {
  it('R11 flips every pixel of the picture and nothing in the padding', () => {
    const mask = createSelectionMask(W, H);
    selectRect(mask, { x: 2, y: 2, w: 5, h: 5 }, NO_RECORDER);
    invertSelection(mask);
    expect(selectedIndexes(mask).size).toBe(W * H - 25);
    expect(isSelected(mask, 3, 3)).toBe(false);
    expect(isSelected(mask, 0, 0)).toBe(true);
    expect(isSelected(mask, W - 1, H - 1)).toBe(true);
    for (let index = W * H; index < mask.cells.length; index += 1) expect(mask.cells[index]).toBe(0);
  });

  it('R11 inverting twice restores the selection', () => {
    const mask = createSelectionMask(W, H);
    selectStroke(mask, { from: { x: 5, y: 5 }, to: { x: 30, y: 17 }, first: true }, 7, NO_RECORDER);
    const before = selectedIndexes(mask);
    invertSelection(mask);
    invertSelection(mask);
    expect(selectedIndexes(mask)).toEqual(before);
  });

  it('R11 inverting a full selection clears it and the bounds are empty', () => {
    const mask = createSelectionMask(W, H);
    selectRect(mask, { x: 0, y: 0, w: W, h: H }, NO_RECORDER);
    invertSelection(mask);
    expect(hasSelection(mask)).toBe(false);
    expect(selectedIndexes(mask).size).toBe(0);
  });

  it('R11 inverting an empty selection selects everything', () => {
    const mask = createSelectionMask(W, H);
    invertSelection(mask);
    expect(selectedIndexes(mask).size).toBe(W * H);
    expect(hasSelection(mask)).toBe(true);
  });
});

describe('fillSelection (reference-editor R12)', () => {
  it('R12 selected pixels take the colour and others stay', () => {
    const raster = createRaster(W, H, 0xff112233);
    const mask = createSelectionMask(W, H);
    selectRect(mask, { x: 5, y: 4, w: 6, h: 3 }, NO_RECORDER);
    const colour = packColour('#00ff00');
    const rect = fillSelection(raster, mask, colour, NO_RECORDER);
    expect(rect).toEqual({ x: 5, y: 4, w: 6, h: 3 });
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) expect(raster.words[y * W + x]).toBe(isSelected(mask, x, y) ? colour : 0xff112233);
  });

  it('R12 with no selection nothing changes and null is returned', () => {
    const raster = createRaster(W, H, 0xff112233);
    expect(fillSelection(raster, createSelectionMask(W, H), 0xff00ff00, NO_RECORDER)).toBeNull();
  });

  it('R12 a sparse selection is filled correctly (only tiles that may hold selected cells are visited)', () => {
    const big = createRaster(200, 200, 0xff000000);
    const mask = createSelectionMask(200, 200);
    selectStroke(mask, { from: { x: 0, y: 0 }, to: { x: 199, y: 199 }, first: true }, 3, NO_RECORDER);
    fillSelection(big, mask, 0xff0000ff, NO_RECORDER);
    for (let y = 0; y < 200; y += 1) for (let x = 0; x < 200; x += 1) expect(big.words[y * 200 + x]).toBe(mask.cells[y * 200 + x] === 1 ? 0xff0000ff : 0xff000000);
  });
});

describe('cropToSelection (reference-editor R13)', () => {
  it('R13 the output is the bounding box; selected pixels keep the source, unselected take the colour; selection is cleared', () => {
    const raster = createRaster(W, H);
    for (let index = 0; index < W * H; index += 1) raster.words[index] = 0xff000000 | index;
    const mask = createSelectionMask(W, H);
    selectStroke(mask, { from: { x: 8, y: 6 }, to: { x: 20, y: 14 }, first: true }, 5, NO_RECORDER);
    const box = { ...mask.bounds };
    const colour = packColour('#ffff00');
    const out = cropToSelection(raster, mask, colour);
    expect(out.raster.width).toBe(box.maxX - box.minX + 1);
    expect(out.raster.height).toBe(box.maxY - box.minY + 1);
    for (let y = 0; y < out.raster.height; y += 1) {
      for (let x = 0; x < out.raster.width; x += 1) {
        const sx = x + box.minX;
        const sy = y + box.minY;
        expect(out.raster.words[y * out.raster.width + x]).toBe(isSelected(mask, sx, sy) ? raster.words[sy * W + sx] : colour);
      }
    }
    expect(hasSelection(out.mask)).toBe(false);
    expect(out.mask.width).toBe(out.raster.width);
  });

  it('R13 crop tightens a superset bounds (after an invert) to the exact box before cropping', () => {
    const raster = createRaster(W, H, 0xff808080);
    const mask = createSelectionMask(W, H);
    selectRect(mask, { x: 10, y: 5, w: 4, h: 3 }, NO_RECORDER);
    invertSelection(mask);
    invertSelection(mask); // bounds is now a superset (whole picture) of a 4 x 3 selection
    const out = cropToSelection(raster, mask, 0xffffffff);
    expect([out.raster.width, out.raster.height]).toEqual([4, 3]);
  });

  it('R13 the source raster and mask are not modified', () => {
    const raster = createRaster(W, H, 0xff808080);
    const mask = createSelectionMask(W, H);
    selectRect(mask, { x: 10, y: 5, w: 4, h: 3 }, NO_RECORDER);
    cropToSelection(raster, mask, 0xffffffff);
    expect(raster.width).toBe(W);
    expect(hasSelection(mask)).toBe(true);
  });
});
