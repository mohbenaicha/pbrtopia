import { describe, expect, it } from 'vitest';
import { rasterizeIslandCoverage } from '../../src/uvCoverage/rasterizeIslandCoverage';
import type { UvMesh } from '../../src/generation/normal/uprightTypes';

function triangle(uvs: number[]): UvMesh {
  return { positions: new Float32Array(9), uvs: new Float32Array(uvs), indices: new Uint32Array([0, 1, 2]) };
}

const count = (coverage: Uint8Array): number => coverage.reduce((sum, value) => sum + value, 0);

describe('rasterizeIslandCoverage', () => {
  it('normal-reauthor R8 a texel is covered when its centre is inside a triangle, edges inclusive', () => {
    // side 4, the triangle (0,0) (4,0) (0,4): texel (c, r) has its centre at (c + 0.5, r + 0.5), covered when c + r <= 3
    const coverage = rasterizeIslandCoverage(triangle([0, 0, 1, 0, 0, 1]), 4);
    expect(coverage.length).toBe(16);
    for (let row = 0; row < 4; row += 1) for (let column = 0; column < 4; column += 1) expect(coverage[row * 4 + column]).toBe(column + row <= 3 ? 1 : 0);
    expect(count(coverage)).toBe(10); // the texels with c + r = 3 have their centre exactly on the hypotenuse
  });

  it('normal-reauthor R8 v runs down: row = v * side', () => {
    const coverage = rasterizeIslandCoverage(triangle([0, 0.5, 1, 0.5, 0, 1]), 8);
    expect(coverage[0]).toBe(0);
    expect(coverage[4 * 8]).toBe(1);
  });

  it('normal-reauthor R8 a mirrored (opposite winding) triangle covers the same texels', () => {
    const a = rasterizeIslandCoverage(triangle([0, 0, 1, 0, 0, 1]), 4);
    const b = rasterizeIslandCoverage(triangle([0, 0, 0, 1, 1, 0]), 4);
    expect(Array.from(b)).toEqual(Array.from(a));
  });

  it('normal-reauthor R8 a degenerate triangle covers nothing', () => {
    expect(count(rasterizeIslandCoverage(triangle([0.1, 0.1, 0.5, 0.5, 0.9, 0.9]), 16))).toBe(0);
  });

  it('normal-reauthor R8 uvs outside 0..1 are clipped to the picture without writing outside it', () => {
    const coverage = rasterizeIslandCoverage(triangle([-2, -2, 3, -2, -2, 3]), 8);
    expect(coverage.length).toBe(64);
    expect(count(coverage)).toBeGreaterThan(0);
  });

  it('normal-reauthor R8 a mesh with no triangles covers nothing and the result is deterministic', () => {
    const empty: UvMesh = { positions: new Float32Array(0), uvs: new Float32Array(0), indices: new Uint32Array(0) };
    expect(count(rasterizeIslandCoverage(empty, 8))).toBe(0);
    const again = rasterizeIslandCoverage(triangle([0, 0, 1, 0, 0, 1]), 4);
    expect(Array.from(again)).toEqual(Array.from(rasterizeIslandCoverage(triangle([0, 0, 1, 0, 0, 1]), 4)));
  });
});
