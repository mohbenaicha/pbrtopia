import { BufferAttribute, BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { buildHiddenTexelMask } from '../../src/hiddenMarks/buildHiddenTexelMask';

// A unit-square quad in UV: triangle 0 is the lower-left half (u + v < 1), triangle 1 the upper-right half.
function quad(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
  geometry.setIndex(new BufferAttribute(Uint32Array.from([0, 1, 2, 3, 2, 1]), 1));
  return geometry;
}
const SIZE = 8;
const at = (mask: Uint8Array, x: number, y: number): number => mask[y * SIZE + x]!;

describe('buildHiddenTexelMask (mesh edit R30)', () => {
  it('mesh edit R30 nothing hidden gives null (no mask is built, no memory kept)', () => {
    expect(buildHiddenTexelMask(quad(), new Uint8Array(2), SIZE)).toBeNull();
  });

  it('mesh edit R30 a hidden triangle marks exactly the texels whose centre lies inside it', () => {
    const mask = buildHiddenTexelMask(quad(), Uint8Array.from([1, 0]), SIZE)!;
    expect(mask).toHaveLength(SIZE * SIZE);
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (x + y < SIZE - 1) expect(at(mask, x, y)).toBe(1); // strictly inside the lower-left half
        if (x + y > SIZE - 1) expect(at(mask, x, y)).toBe(0); // inside the visible half
      }
    }
  });

  it('mesh edit R30 a texel whose centre is on the edge shared with a visible triangle is not marked (the visible triangle writes it)', () => {
    const mask = buildHiddenTexelMask(quad(), Uint8Array.from([1, 0]), SIZE)!;
    for (let x = 0; x < SIZE; x += 1) expect(at(mask, x, SIZE - 1 - x)).toBe(0);
  });

  it('mesh edit R30 everything hidden marks every covered texel and leaves the gutter at 0', () => {
    const half = new BufferGeometry();
    half.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
    half.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 0.5, 0, 0, 0.5]), 2));
    half.setIndex(new BufferAttribute(Uint32Array.from([0, 1, 2]), 1));
    const mask = buildHiddenTexelMask(half, Uint8Array.from([1]), SIZE)!;
    expect(at(mask, 0, 0)).toBe(1);
    expect(at(mask, SIZE - 1, SIZE - 1)).toBe(0);
    expect(mask.reduce((sum, value) => sum + value, 0)).toBeGreaterThan(0);
  });

  it('mesh edit R30 a hidden triangle that overlaps a visible one in UV does not hide the visible triangle\'s texels', () => {
    const stacked = quad();
    stacked.setIndex(new BufferAttribute(Uint32Array.from([0, 1, 2, 0, 1, 2]), 1)); // two identical triangles, one hidden
    const mask = buildHiddenTexelMask(stacked, Uint8Array.from([1, 0]), SIZE)!;
    expect(mask.every((value) => value === 0)).toBe(true);
  });

  it('mesh edit R30 a geometry without an index or without UVs is handled: no index reads three vertices per triangle, no UVs gives null', () => {
    const flat = new BufferGeometry();
    flat.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    flat.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 0.5, 0, 0, 0.5]), 2));
    expect(buildHiddenTexelMask(flat, Uint8Array.from([1]), SIZE)!.some((value) => value === 1)).toBe(true);
    const noUv = new BufferGeometry();
    noUv.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    expect(buildHiddenTexelMask(noUv, Uint8Array.from([1]), SIZE)).toBeNull();
  });
});
