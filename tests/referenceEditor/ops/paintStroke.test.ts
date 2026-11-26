import { describe, expect, it } from 'vitest';
import { createRaster } from '../../../src/referenceEditor/model/raster';
import { createSelectionMask } from '../../../src/referenceEditor/model/selectionMask';
import { NO_RECORDER } from '../../../src/referenceEditor/model/writeRecorder';
import { packColour } from '../../../src/referenceEditor/model/packColour';
import { paintStroke } from '../../../src/referenceEditor/ops/paintStroke';
import { selectRect } from '../../../src/referenceEditor/ops/selectRect';
import { coveredSet, expectedNewPixels } from '../bruteCoverage';

const W = 40;
const H = 30;
const WHITE = 0xffffffff;
const RED = packColour('#ff0000');
const changed = (words: Uint32Array): Set<number> => new Set([...words.keys()].filter((index) => words[index] !== WHITE));

describe('paintStroke (reference-editor R7)', () => {
  it('R7 packColour gives opaque 0xFFBBGGRR', () => {
    expect(packColour('#102030')).toBe(0xff302010);
  });

  it('R7 a lone click of size 1 paints exactly the pixel under the pointer', () => {
    const raster = createRaster(W, H);
    paintStroke(raster, null, { from: { x: 5, y: 6 }, to: { x: 5, y: 6 }, first: true }, 1, RED, NO_RECORDER);
    expect([...changed(raster.words)]).toEqual([6 * W + 5]);
  });

  it.each([
    ['horizontal', { x: 5, y: 10 }, { x: 30, y: 10 }, 7],
    ['vertical', { x: 12, y: 3 }, { x: 12, y: 25 }, 6],
    ['diagonal', { x: 4, y: 4 }, { x: 33, y: 22 }, 9],
    ['steep with odd size', { x: 20, y: 2 }, { x: 24, y: 28 }, 5],
  ])('R7 a %s first segment paints exactly the capsule of the coverage rule, gap-free', (_name, from, to, size) => {
    const raster = createRaster(W, H);
    paintStroke(raster, null, { from, to, first: true }, size, RED, NO_RECORDER);
    expect(changed(raster.words)).toEqual(coveredSet(from, to, size, W, H));
  });

  it('R7 a later segment writes only the pixels outside the disc already painted at its start', () => {
    const raster = createRaster(W, H);
    const a = { x: 6, y: 8 };
    const b = { x: 20, y: 14 };
    const c = { x: 33, y: 9 };
    paintStroke(raster, null, { from: a, to: b, first: true }, 8, RED, NO_RECORDER);
    const before = changed(raster.words);
    const rect = paintStroke(raster, null, { from: b, to: c, first: false }, 8, RED, NO_RECORDER);
    const added = new Set([...changed(raster.words)].filter((index) => !before.has(index)));
    expect(added).toEqual(new Set([...expectedNewPixels(b, c, 8, W, H, false)].filter((index) => !before.has(index))));
    expect(rect).not.toBeNull();
  });

  it('R7 the incremental stroke equals the union of the full capsules of its segments', () => {
    const points = [{ x: 3, y: 3 }, { x: 15, y: 20 }, { x: 22, y: 5 }, { x: 36, y: 25 }];
    const raster = createRaster(W, H);
    points.slice(1).forEach((to, k) => paintStroke(raster, null, { from: points[k]!, to, first: k === 0 }, 6, RED, NO_RECORDER));
    const union = new Set<number>();
    points.slice(1).forEach((to, k) => coveredSet(points[k]!, to, 6, W, H).forEach((index) => union.add(index)));
    expect(changed(raster.words)).toEqual(union);
  });

  it('R7 the same samples give the same pixels and a reversed segment gives the same pixels', () => {
    const a = { x: 5, y: 5 };
    const b = { x: 30, y: 20 };
    const one = createRaster(W, H);
    const two = createRaster(W, H);
    paintStroke(one, null, { from: a, to: b, first: true }, 7, RED, NO_RECORDER);
    paintStroke(two, null, { from: b, to: a, first: true }, 7, RED, NO_RECORDER);
    expect([...one.words]).toEqual([...two.words]);
  });

  it('R7 painting the same segment twice equals painting it once', () => {
    const raster = createRaster(W, H);
    const seg = { from: { x: 5, y: 5 }, to: { x: 30, y: 20 }, first: true };
    paintStroke(raster, null, seg, 7, RED, NO_RECORDER);
    const once = Uint32Array.from(raster.words);
    paintStroke(raster, null, seg, 7, RED, NO_RECORDER);
    expect([...raster.words]).toEqual([...once]);
  });

  it('R7 with a selection, only pixels inside it change', () => {
    const raster = createRaster(W, H);
    const mask = createSelectionMask(W, H);
    selectRect(mask, { x: 10, y: 5, w: 10, h: 10 }, NO_RECORDER);
    paintStroke(raster, mask, { from: { x: 0, y: 10 }, to: { x: 39, y: 10 }, first: true }, 9, RED, NO_RECORDER);
    const hit = changed(raster.words);
    expect(hit.size).toBeGreaterThan(0);
    for (const index of hit) {
      const x = index % W;
      const y = Math.floor(index / W);
      expect(x >= 10 && x < 20 && y >= 5 && y < 15).toBe(true);
    }
  });

  it('R7 a stroke outside the picture is clipped to the picture and returns the changed rectangle', () => {
    const raster = createRaster(W, H);
    const rect = paintStroke(raster, null, { from: { x: -5, y: -5 }, to: { x: 3, y: 3 }, first: true }, 6, RED, NO_RECORDER);
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.y).toBeGreaterThanOrEqual(0);
    expect(changed(raster.words).size).toBeGreaterThan(0);
  });

  it('R7 a stroke that changes nothing returns null', () => {
    const raster = createRaster(W, H);
    const mask = createSelectionMask(W, H);
    selectRect(mask, { x: 30, y: 20, w: 3, h: 3 }, NO_RECORDER);
    expect(paintStroke(raster, mask, { from: { x: 2, y: 2 }, to: { x: 4, y: 4 }, first: true }, 3, RED, NO_RECORDER)).toBeNull();
  });
});
