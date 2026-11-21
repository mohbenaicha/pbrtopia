import { describe, expect, it } from 'vitest';
import { findIslands } from '../../../src/generation/normal/findIslands';
import type { UvMesh } from '../../../src/generation/normal/uprightTypes';
import { joinMeshes, quadMesh } from './meshFixtures';

describe('findIslands', () => {
  it('normal-map R15 two triangles sharing an edge in position and uv are one island', () => {
    const islands = findIslands(quadMesh({ centre: [0.5, 0.5], half: 0.2 }));
    expect(islands).toEqual([[0, 1]]);
  });

  it('normal-map R15 triangles that share a position but not a uv are two islands', () => {
    // two triangles on one wall that touch along an edge in the world, but their uv copies sit apart (a seam)
    const mesh: UvMesh = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
      uvs: new Float32Array([0.1, 0.1, 0.3, 0.1, 0.1, 0.3, 0.6, 0.6, 0.8, 0.8, 0.6, 0.8]),
      indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
    };
    expect(findIslands(mesh)).toHaveLength(2);
  });

  it('normal-map R15 quads with no shared vertex are separate islands, in order of first triangle', () => {
    const mesh = joinMeshes(quadMesh({ centre: [0.2, 0.2], half: 0.1, at: 0 }), quadMesh({ centre: [0.7, 0.7], half: 0.1, at: 1 }));
    expect(findIslands(mesh)).toEqual([[0, 1], [2, 3]]);
  });

  it('normal-map R15 a mirrored island is still one island', () => {
    expect(findIslands(quadMesh({ centre: [0.5, 0.5], half: 0.2, mirrored: true }))).toHaveLength(1);
  });
});
