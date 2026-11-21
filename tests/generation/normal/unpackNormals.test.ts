import { describe, expect, it } from 'vitest';
import { buildUprightSheet } from '../../../src/generation/normal/buildUprightSheet';
import { deriveNormals } from '../../../src/generation/normal/deriveNormals';
import { unpackNormals } from '../../../src/generation/normal/unpackNormals';
import type { PixelPicture } from '../../../src/generation/normal/uprightTypes';
import { angleBetweenDeg, decodeNormal, pixelAt, quadMesh, solidPicture } from './meshFixtures';

const SIDE = 64;
const CENTRE = 0.5;
const HALF = 0.2;

// Height rising towards the picture top of the sheet by four whole 8-bit levels per texel (a slope above the 0.01 floor) (so the ramp is exact).
function rampUp(side: number): PixelPicture {
  const rgba = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y += 1) {
    const v = 255 - 4 * y;
    for (let x = 0; x < side; x += 1) rgba.set([v, v, v, 255], (y * side + x) * 4);
  }
  return { side, rgba };
}

describe('unpackNormals', () => {
  for (const turnDeg of [0, 37, 90, 200, -123]) {
    it(`normal-map R19 a ramp up the world on an island turned ${turnDeg} degrees equals the ramp computed directly`, () => {
      const mesh = quadMesh({ centre: [CENTRE, CENTRE], half: HALF, turnDeg });
      const built = buildUprightSheet(solidPicture(SIDE, [200, 100, 50]), mesh);
      if (!built.ok) throw new Error('expected a sheet');
      const result = unpackNormals(deriveNormals(rampUp(SIDE), built.value), built.value);
      expect(result.side).toBe(SIDE);
      // directly in the albedo layout: height rises along the picture direction (sin a, -cos a), the tilt is 45 degrees
      const a = (turnDeg * Math.PI) / 180;
      const expected = { x: -Math.sin(a) / Math.SQRT2, y: -Math.cos(a) / Math.SQRT2, z: Math.SQRT1_2 };
      const alpha = a;
      let checked = 0;
      for (let y = 0; y < SIDE; y += 1) {
        for (let x = 0; x < SIDE; x += 1) {
          // the quad's interior, 4 texels in from its border, in the quad's own turned frame
          const dx = (x + 0.5) / SIDE - CENTRE;
          const dy = (y + 0.5) / SIDE - CENTRE;
          const u = dx * Math.cos(alpha) + dy * Math.sin(alpha);
          const w = -dx * Math.sin(alpha) + dy * Math.cos(alpha);
          if (Math.abs(u) > HALF - 4 / SIDE || Math.abs(w) > HALF - 4 / SIDE) continue;
          expect(angleBetweenDeg(decodeNormal(result, x, y), expected)).toBeLessThan(2);
          checked += 1;
        }
      }
      expect(checked).toBeGreaterThan(200);
    });
  }

  it('normal-map R19 texels of no island are 128, 128, 255', () => {
    const built = buildUprightSheet(solidPicture(SIDE, [200, 100, 50]), quadMesh({ centre: [CENTRE, CENTRE], half: HALF }));
    if (!built.ok) throw new Error('expected a sheet');
    const result = unpackNormals(deriveNormals(rampUp(SIDE), built.value), built.value);
    for (const [x, y] of [[0, 0], [SIDE - 1, SIDE - 1], [5, 60]] as const) expect(pixelAt(result, x, y)).toEqual([128, 128, 255]);
    expect(result.rgba[3]).toBe(255);
  });

  it('normal-map R19 a mirrored island is unpacked by the same rotation, not flipped', () => {
    const mesh = quadMesh({ centre: [CENTRE, CENTRE], half: HALF, turnDeg: 60, mirrored: true });
    const built = buildUprightSheet(solidPicture(SIDE, [200, 100, 50]), mesh);
    if (!built.ok) throw new Error('expected a sheet');
    const result = unpackNormals(deriveNormals(rampUp(SIDE), built.value), built.value);
    const a = (60 * Math.PI) / 180; // world up appears 60 degrees clockwise from the picture top whether or not the island is mirrored
    const expected = { x: -Math.sin(a) / Math.SQRT2, y: -Math.cos(a) / Math.SQRT2, z: Math.SQRT1_2 };
    expect(angleBetweenDeg(decodeNormal(result, 32, 32), expected)).toBeLessThan(2);
  });

  it('normal-map R19 an island\'s own texels are never overwritten by the growth of a neighbour closer than 6 px', () => {
    // two 15-texel quads 0.5 texel apart, so each one's 3 px growth reaches into the other; one turned 0, the other 90 degrees
    const left = quadMesh({ centre: [0.3, 0.5], half: 0.12, turnDeg: 90, at: 0 });
    const right = quadMesh({ centre: [0.54 + 0.5 / SIDE, 0.5], half: 0.12, turnDeg: 0, at: 1 });
    const both = { positions: new Float32Array([...left.positions, ...right.positions]), uvs: new Float32Array([...left.uvs, ...right.uvs]), indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]) };
    for (const mesh of [both, { ...both, indices: new Uint32Array([4, 5, 6, 4, 6, 7, 0, 1, 2, 0, 2, 3]) }]) { // either piece may be written last
      const built = buildUprightSheet(solidPicture(SIDE, [200, 100, 50]), mesh);
      if (!built.ok) throw new Error('expected a sheet');
      expect(built.value.pieces).toHaveLength(2);
      const result = unpackNormals(deriveNormals(rampUp(SIDE), built.value), built.value);
      const leftEdge = 25; // the left quad ends at texel 26.9: this texel is its own, and inside the right quad's growth (from 24.4)
      const rightEdge = 29; // the right quad starts at texel 27.4: this texel is its own, and inside the left quad's growth (to 29.9)
      const expectLeft = { x: -Math.sin(Math.PI / 2) / Math.SQRT2, y: 0, z: Math.SQRT1_2 };
      const expectRight = { x: 0, y: -Math.SQRT1_2, z: Math.SQRT1_2 };
      for (let y = 28; y <= 36; y += 1) {
        expect(angleBetweenDeg(decodeNormal(result, leftEdge, y), expectLeft)).toBeLessThan(2);
        expect(angleBetweenDeg(decodeNormal(result, rightEdge, y), expectRight)).toBeLessThan(2);
      }
    }
  });

  it('normal-map R19 pieces scaled down to fit the sheet still unpack to the ramp computed directly', () => {
    const left = quadMesh({ centre: [0.25, 0.5], half: 0.23, turnDeg: 0, at: 0 });
    const right = quadMesh({ centre: [0.75, 0.5], half: 0.23, turnDeg: 90, at: 1 });
    const mesh = { positions: new Float32Array([...left.positions, ...right.positions]), uvs: new Float32Array([...left.uvs, ...right.uvs]), indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]) };
    const built = buildUprightSheet(solidPicture(SIDE, [200, 100, 50]), mesh);
    if (!built.ok) throw new Error('expected a sheet');
    expect(built.value.scale).toBeLessThan(1); // two 31-texel pieces with 4 px gaps do not fit a 64 px sheet at full size
    const result = unpackNormals(deriveNormals(rampUp(SIDE), built.value), built.value);
    const expectLeft = { x: 0, y: -Math.SQRT1_2, z: Math.SQRT1_2 };
    const expectRight = { x: -Math.SQRT1_2, y: 0, z: Math.SQRT1_2 };
    for (const y of [26, 32, 38]) {
      for (const x of [14, 18, 22]) expect(angleBetweenDeg(decodeNormal(result, x, y), expectLeft)).toBeLessThan(3);
      for (const x of [42, 46, 50]) expect(angleBetweenDeg(decodeNormal(result, x, y), expectRight)).toBeLessThan(3);
    }
  });

  it('normal-map R20 the same inputs give the same unpacked normals', () => {
    const built = buildUprightSheet(solidPicture(SIDE, [200, 100, 50]), quadMesh({ centre: [CENTRE, CENTRE], half: HALF, turnDeg: 17 }));
    if (!built.ok) throw new Error('expected a sheet');
    const normals = deriveNormals(rampUp(SIDE), built.value);
    expect(Array.from(unpackNormals(normals, built.value).rgba)).toEqual(Array.from(unpackNormals(normals, built.value).rgba));
  });
});
