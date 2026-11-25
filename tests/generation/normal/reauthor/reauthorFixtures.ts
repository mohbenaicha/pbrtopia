import type { PixelPicture, UvMesh } from '../../../../src/generation/normal/uprightTypes';
import { joinMeshes } from '../meshFixtures';

export { joinMeshes };

/** One quad of two triangles (4 own vertices, corners in order). positions: 4 x [x,y,z]; uvs: 4 x [u,v], v down. */
export function quadFrom(positions: number[][], uvs: number[][]): UvMesh {
  return {
    positions: new Float32Array(positions.flat()),
    uvs: new Float32Array(uvs.flat()),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}

/** A unit wall at x in [x0, x0 + 1] (XY plane) drawn into the uv box [u0, u1] x [v0, v1]; `mirrored` flips u. */
export function wall(x0: number, box: [number, number, number, number], mirrored = false): UvMesh {
  const [u0, v0, u1, v1] = box;
  const [ua, ub] = mirrored ? [u1, u0] : [u0, u1];
  return quadFrom(
    [[x0, 0, 0], [x0 + 1, 0, 0], [x0 + 1, 1, 0], [x0, 1, 0]],
    [[ua, v0], [ub, v0], [ub, v1], [ua, v1]],
  );
}

/** Two walls that share the 3D edge x = 1 with different uvs: A at u 0.1..0.4, B at u 0.6..0.9, both v 0.1..0.4. */
export function twoWallsWithSeam(mirroredB = false): UvMesh {
  return joinMeshes(wall(0, [0.1, 0.1, 0.4, 0.4]), wall(1, [0.6, 0.1, 0.9, 0.4], mirroredB));
}

/** A square picture whose every texel is the given rgba. */
export function solidPicture(side: number, rgba: [number, number, number, number]): PixelPicture {
  const data = new Uint8ClampedArray(side * side * 4);
  for (let at = 0; at < side * side; at += 1) data.set(rgba, at * 4);
  return { side, rgba: data };
}

export const FLAT: [number, number, number, number] = [128, 128, 255, 255];

/** Encodes a unit normal with the spec's code: round(c * 127 + 128). */
export function encodeNormal(x: number, y: number, z: number): [number, number, number, number] {
  const length = Math.hypot(x, y, z);
  const code = (c: number): number => Math.min(255, Math.max(0, Math.round((c / length) * 127 + 128)));
  return [code(x), code(y), code(z), 255];
}

/** Small deterministic generator (mulberry32) so property tests are repeatable. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function texelAt(picture: PixelPicture, column: number, row: number): number[] {
  const at = (row * picture.side + column) * 4;
  return [picture.rgba[at]!, picture.rgba[at + 1]!, picture.rgba[at + 2]!, picture.rgba[at + 3]!];
}
