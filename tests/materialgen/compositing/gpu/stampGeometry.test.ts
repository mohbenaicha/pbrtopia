import { describe, expect, it } from 'vitest';
import { stampBounds, tileRect, unionRect, type AtlasGrid } from '../../../../src/materialgen/compositing/gpu/stampGeometry';
import { toLinearColour } from '../../../../src/materialgen/compositing/gpu/paintMaterial';

const grid: AtlasGrid = { columns: 10, rows: 20, inset: 0 };

describe('materialgen/compositing stamp geometry (R16 R28)', () => {
  it('R5 the atlas tile of an index is its cell in row-major order', () => {
    expect(tileRect(grid, 0)).toEqual({ u0: 0, v0: 0, du: 0.1, dv: 0.05 });
    const last = tileRect(grid, 199);
    expect(last.u0).toBeCloseTo(0.9, 10);
    expect(last.v0).toBeCloseTo(0.95, 10);
    const second = tileRect(grid, 11);
    expect([second.u0, second.v0]).toEqual([0.1, 0.05]);
  });

  it('R5 an inset shrinks the tile by that fraction on every side, keeping it centred', () => {
    const inset = tileRect({ columns: 2, rows: 2, inset: 0.1 }, 3);
    expect(inset.du).toBeCloseTo(0.4, 10);
    expect(inset.u0).toBeCloseTo(0.5 + 0.05, 10);
    expect(inset.v0).toBeCloseTo(0.5 + 0.05, 10);
  });

  it('R28 the bounds of a stamp are its rotated square plus a margin, in whole texels, inside the picture', () => {
    const rect = stampBounds({ x: 0.5, y: 0.5, size: 0.5 }, 256, 1)!;
    const reach = (0.5 * Math.SQRT2 * 256) / 2;
    expect(rect.x0).toBe(Math.floor(128 - reach - 1));
    expect(rect.x1).toBe(Math.ceil(128 + reach + 1));
    expect(rect.x0).toBeGreaterThanOrEqual(0);
    expect(rect.x1).toBeLessThanOrEqual(256);
  });

  it('R16 R28 a stamp across the edge has bounds on both sides, and a far corner stays outside them', () => {
    const rect = stampBounds({ x: 0.02, y: 0.5, size: 0.1 }, 256, 1)!;
    expect(rect.x0).toBe(0);
    expect(rect.x1).toBe(256); // left part and the part wrapped to the right, as one rectangle
    expect(rect.y1).toBeLessThan(256);
    expect(rect.y0).toBeGreaterThan(0);
  });

  it('R28 the union of two rectangles, and nothing for no rectangle', () => {
    expect(unionRect(null, { x0: 1, y0: 2, x1: 3, y1: 4 })).toEqual({ x0: 1, y0: 2, x1: 3, y1: 4 });
    expect(unionRect({ x0: 5, y0: 5, x1: 6, y1: 6 }, { x0: 1, y0: 2, x1: 3, y1: 4 })).toEqual({ x0: 1, y0: 2, x1: 6, y1: 6 });
    expect(unionRect(null, null)).toBeNull();
  });
});

describe('materialgen/compositing material colour (R17)', () => {
  it('R17 the sRGB bytes of a material become linear light for the blend', () => {
    const [r, g, b] = toLinearColour([255, 128, 0]);
    expect(r).toBeCloseTo(1, 6);
    expect(g).toBeCloseTo(0.2158605, 5);
    expect(b).toBe(0);
  });
});
