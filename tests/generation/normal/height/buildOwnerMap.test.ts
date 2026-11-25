import { describe, expect, it } from 'vitest';
import { buildOwnerMap } from '../../../../src/generation/normal/height/buildOwnerMap';
import { joinMeshes } from '../meshFixtures';
import { wall } from '../reauthor/reauthorFixtures';

const SIDE = 512; // wall A's uv box 0.1..0.4 is texels 51.2..204.8
const ownerAt = (owner: Uint16Array, x: number, y: number): number => owner[y * SIDE + x]!;

describe('buildOwnerMap', () => {
  const single = wall(0, [0.1, 0.1, 0.4, 0.4]);

  it('normal-height-edit R1 texels inside an island are owned by it, texels of no island by nobody', () => {
    const owner = buildOwnerMap(single, SIDE);
    expect(ownerAt(owner, 100, 100)).toBe(1);
    expect(ownerAt(owner, 400, 400)).toBe(0);
    expect(ownerAt(owner, 10, 10)).toBe(0);
  });

  it('normal-height-edit R1 the growth of 3 px around an island is owned by it, beyond that nobody', () => {
    const owner = buildOwnerMap(single, SIDE);
    expect(ownerAt(owner, 206, 100)).toBe(1); // centre 1.7 px beyond the edge at 204.8
    expect(ownerAt(owner, 207, 100)).toBe(1); // 2.7 px
    expect(ownerAt(owner, 209, 100)).toBe(0); // 4.7 px
  });

  it('normal-height-edit R1 inside texels beat a neighbour island\'s growth, and growth ties go to the lower island', () => {
    const gap = 2 / SIDE;
    const mesh = joinMeshes(wall(0, [0.1, 0.1, 0.4, 0.4]), wall(1, [0.4 + gap, 0.1, 0.7, 0.4])); // B's left edge at texel 206.8
    const owner = buildOwnerMap(mesh, SIDE);
    expect(ownerAt(owner, 203, 100)).toBe(1); // inside A
    expect(ownerAt(owner, 207, 100)).toBe(2); // inside B although within 3 px of A
    expect(ownerAt(owner, 205, 100)).toBe(1); // growth of both: the lower island
    expect(ownerAt(owner, 206, 100)).toBe(1);
  });

  it('normal-height-edit R1 every island of the mesh is owned, whatever the albedo looks like (the map reads the mesh only)', () => {
    const mesh = joinMeshes(wall(0, [0.1, 0.1, 0.2, 0.2]), wall(1, [0.5, 0.5, 0.6, 0.6]), wall(2, [0.8, 0.1, 0.9, 0.2]));
    const owner = buildOwnerMap(mesh, SIDE);
    expect(ownerAt(owner, 77, 77)).toBe(1);
    expect(ownerAt(owner, 281, 281)).toBe(2);
    expect(ownerAt(owner, 435, 77)).toBe(3);
  });

  it('normal-height-edit R1 the map is the same every time (generation and panel load build the same one)', () => {
    const mesh = joinMeshes(wall(0, [0.1, 0.1, 0.4, 0.4]), wall(1, [0.41, 0.1, 0.7, 0.4]));
    expect(Array.from(buildOwnerMap(mesh, SIDE))).toEqual(Array.from(buildOwnerMap(mesh, SIDE)));
  });

  it('normal-height-edit R1 a texel outside the picture is never written, an island reaching the edge is clipped', () => {
    const edge = wall(0, [0.0, 0.0, 0.2, 0.2]);
    const owner = buildOwnerMap(edge, SIDE);
    expect(owner.length).toBe(SIDE * SIDE);
    expect(ownerAt(owner, 0, 0)).toBe(1);
  });
});
