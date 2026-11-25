import { describe, expect, it } from 'vitest';
import { computeDirtyRegion } from '../../../src/materialMasks/bake/computeDirtyRegion';

const SIDE = 64;
const TILE = 16;
const NONE = 255;

/** A label plane that is `fill` everywhere except the listed texels. */
function plane(fill: number, spots: Array<{ x: number; y: number; label: number }> = []): Uint8Array {
  const labels = new Uint8Array(SIDE * SIDE).fill(fill);
  for (const { x, y, label } of spots) labels[y * SIDE + x] = label;
  return labels;
}
const tilesOf = (flags: Uint8Array): number[] => [...flags].flatMap((flag, tile) => (flag === 1 ? [tile] : []));
const tileAt = (x: number, y: number): number => Math.floor(y / TILE) * (SIDE / TILE) + Math.floor(x / TILE);

describe('computeDirtyRegion (mask-bake-session R7)', () => {
  it('mask-bake-session R7 the tiles to bake hold every texel of a changed label and those within the feather radius of it', () => {
    const labels = plane(NONE, [{ x: 20, y: 20, label: 2 }]);
    const region = computeDirtyRegion({ labels, side: SIDE, rowCount: 4, changedLabels: [2], radius: 2, reach: 0, tile: TILE })!;
    expect(tilesOf(region.bake)).toContain(tileAt(20, 20));
    const near = computeDirtyRegion({ labels: plane(NONE, [{ x: 16, y: 16, label: 2 }]), side: SIDE, rowCount: 4, changedLabels: [2], radius: 2, reach: 0, tile: TILE })!;
    for (const [x, y] of [[14, 14], [14, 16], [16, 14], [16, 16]] as const) expect(near.bake[tileAt(x, y)]).toBe(1); // a texel across a tile edge is within the radius
  });

  it('mask-bake-session R7 a label that did not change does not mark its tiles, a 255 texel never marks one, and a far tile stays clean', () => {
    const labels = plane(NONE, [{ x: 2, y: 2, label: 1 }, { x: 60, y: 60, label: 2 }]);
    const region = computeDirtyRegion({ labels, side: SIDE, rowCount: 4, changedLabels: [2], radius: 1, reach: 0, tile: TILE })!;
    expect(tilesOf(region.bake)).toEqual([tileAt(60, 60), tileAt(47, 60), tileAt(60, 47), tileAt(47, 47)].sort((a, b) => a - b));
    expect(region.bake[tileAt(2, 2)]).toBe(0);
  });

  it('mask-bake-session R7 a change of row 0 includes the texels whose label has no row, never the 255 texels', () => {
    const labels = plane(NONE, [{ x: 40, y: 8, label: 9 }]);
    const withRow0 = computeDirtyRegion({ labels, side: SIDE, rowCount: 4, changedLabels: [0], radius: 0, reach: 0, tile: TILE })!;
    expect(tilesOf(withRow0.bake)).toEqual([tileAt(40, 8)]);
    const other = computeDirtyRegion({ labels, side: SIDE, rowCount: 4, changedLabels: [1], radius: 0, reach: 0, tile: TILE })!;
    expect(tilesOf(other.bake)).toEqual([]);
  });

  it('mask-bake-session R7 the tiles to fill reach the gutter reach beyond the tiles to bake, and are never fewer', () => {
    const labels = plane(NONE, [{ x: 20, y: 20, label: 2 }]);
    const region = computeDirtyRegion({ labels, side: SIDE, rowCount: 4, changedLabels: [2], radius: 0, reach: 3, tile: TILE })!;
    expect(tilesOf(region.bake)).toEqual([tileAt(20, 20)]);
    for (const tile of tilesOf(region.bake)) expect(region.fill[tile]).toBe(1);
    expect(tilesOf(region.fill).length).toBe(9);
  });

  it('mask-bake-session R7 the share is the fraction of the tiles to bake', () => {
    const labels = plane(NONE, [{ x: 20, y: 20, label: 2 }]);
    const region = computeDirtyRegion({ labels, side: SIDE, rowCount: 4, changedLabels: [2], radius: 0, reach: 0, tile: TILE })!;
    expect(region.share).toBeCloseTo(1 / 16);
  });

  it('mask-bake-session R7 a radius or reach wider than a tile gives no region, so the caller bakes every texel', () => {
    const labels = plane(1);
    expect(computeDirtyRegion({ labels, side: SIDE, rowCount: 4, changedLabels: [1], radius: 4, reach: 17, tile: TILE })).toBeNull();
    expect(computeDirtyRegion({ labels, side: SIDE, rowCount: 4, changedLabels: [1], radius: 17, reach: 0, tile: TILE })).toBeNull();
  });
});
