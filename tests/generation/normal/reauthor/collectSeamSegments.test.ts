import { describe, expect, it } from 'vitest';
import { collectSeamSegments } from '../../../../src/generation/normal/reauthor/collectSeamSegments';
import type { UvMesh } from '../../../../src/generation/normal/uprightTypes';
import { joinMeshes, quadFrom, twoWallsWithSeam, wall } from './reauthorFixtures';

const SIDE = 100;

describe('collectSeamSegments', () => {
  it('normal-reauthor R7 two quads that share an edge in 3D with different uvs give one pair, in texels', () => {
    const pairs = collectSeamSegments(twoWallsWithSeam(), SIDE);
    expect(pairs).toHaveLength(1);
    const [first, second] = pairs[0]!;
    const byX = [first, second].sort((a, b) => a[0] - b[0]);
    // A's side of the seam is u = 0.4 (texel 40), B's is u = 0.6 (texel 60); both run over v 0.1..0.4
    expect(Math.abs(byX[0]![1] - byX[0]![3])).toBeCloseTo(30, 4);
    expect(byX[0]![0]).toBeCloseTo(40, 4);
    expect(byX[1]![0]).toBeCloseTo(60, 4);
    // the two segments run in the same 3D direction: both go down the picture, or both go up
    expect(Math.sign(byX[0]![3] - byX[0]![1])).toBe(Math.sign(byX[1]![3] - byX[1]![1]));
  });

  it('normal-reauthor R7 the two triangles of one quad (same 3D edge, same uv) are not a seam', () => {
    expect(collectSeamSegments(wall(0, [0.1, 0.1, 0.4, 0.4]), SIDE)).toEqual([]);
  });

  it('normal-reauthor R7 an edge of a single triangle (an open border) is never a seam', () => {
    const lone: UvMesh = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), uvs: new Float32Array([0.1, 0.1, 0.4, 0.1, 0.1, 0.4]), indices: new Uint32Array([0, 1, 2]) };
    expect(collectSeamSegments(lone, SIDE)).toEqual([]);
  });

  it('normal-reauthor R7 an edge used by three triangles is not a seam', () => {
    // a third quad on the same 3D edge x = 1 (a wall folding back along z)
    const fold = joinMeshes(wall(0, [0.1, 0.1, 0.4, 0.4]), wall(1, [0.6, 0.1, 0.9, 0.4]), quadFrom([[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]], [[0.6, 0.6], [0.9, 0.6], [0.9, 0.9], [0.6, 0.9]]));
    expect(collectSeamSegments(fold, SIDE)).toEqual([]);
  });

  it('normal-reauthor R7 islands that are mirrored in uv still pair, and both segments agree on direction', () => {
    const pairs = collectSeamSegments(twoWallsWithSeam(true), SIDE);
    expect(pairs).toHaveLength(1);
    const [a, b] = pairs[0]!;
    expect(Math.sign(a[3] - a[1])).toBe(Math.sign(b[3] - b[1]));
  });

  it('normal-reauthor R7 end points that differ by less than the rounding unit pair; by more, they do not', () => {
    const quantum = 2 / 1e5; // the extent of these meshes is 2
    const shifted = (by: number): UvMesh => joinMeshes(wall(0, [0.1, 0.1, 0.4, 0.4]), quadFrom([[1 + by, 0, 0], [2, 0, 0], [2, 1, 0], [1 + by, 1, 0]], [[0.6, 0.1], [0.9, 0.1], [0.9, 0.4], [0.6, 0.4]]));
    expect(collectSeamSegments(shifted(0.4 * quantum), SIDE)).toHaveLength(1);
    expect(collectSeamSegments(shifted(1.6 * quantum), SIDE)).toHaveLength(0);
  });

  it('normal-reauthor R7 uvs that differ by under half a texel at both ends are not a seam; over half a texel at one end is', () => {
    const near = (shift: number): UvMesh => joinMeshes(wall(0, [0.1, 0.1, 0.4, 0.4]), quadFrom([[1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]], [[0.4, 0.1], [0.9, 0.1], [0.9, 0.4], [0.4 + shift, 0.4]]));
    expect(collectSeamSegments(near(0.4 / SIDE), SIDE)).toHaveLength(0);
    expect(collectSeamSegments(near(0.6 / SIDE), SIDE)).toHaveLength(1);
  });

  it('normal-reauthor R7 the result is deterministic and the mesh is not changed', () => {
    const mesh = twoWallsWithSeam();
    const before = Array.from(mesh.uvs);
    expect(collectSeamSegments(mesh, SIDE)).toEqual(collectSeamSegments(mesh, SIDE));
    expect(Array.from(mesh.uvs)).toEqual(before);
  });

  it('normal-reauthor R7 a mesh with no triangles has no seams', () => {
    expect(collectSeamSegments({ positions: new Float32Array(0), uvs: new Float32Array(0), indices: new Uint32Array(0) }, SIDE)).toEqual([]);
  });
});
