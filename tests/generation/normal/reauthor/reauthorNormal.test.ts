import { describe, expect, it } from 'vitest';
import { reauthorNormal } from '../../../../src/generation/normal/reauthor/reauthorNormal';
import { ADOPTED_PARAMS, DEFAULT_PARAMS } from '../../../../src/normalRecipe/reauthorParams';
import type { PixelPicture } from '../../../../src/generation/normal/uprightTypes';
import { FLAT, encodeNormal, seededRandom, solidPicture, texelAt, twoWallsWithSeam, wall } from './reauthorFixtures';

const SIDE = 512; // seamRadius 16 is 8 texels here
const tilt = encodeNormal(0.5, 0, 0.866);
const maxDifference = (a: number[], b: number[]): number => Math.max(...a.map((value, index) => Math.abs(value - b[index]!)));

describe('reauthorNormal', () => {
  const mesh = twoWallsWithSeam();
  const base = solidPicture(SIDE, tilt);

  it('normal-reauthor R10 slope 45 and no flatten give the base back inside the islands, within one level', () => {
    for (const params of [{ slopeDeg: 45, seamRadius: 0, seamFlatten: 100 }, { slopeDeg: 45, seamRadius: 16, seamFlatten: 0 }]) {
      const result = reauthorNormal(base, mesh, params);
      for (const [column, row] of [[100, 100], [150, 150], [200, 60], [330, 100], [400, 180]]) expect(maxDifference(texelAt(result, column!, row!), tilt)).toBeLessThanOrEqual(1);
    }
  });

  it('normal-reauthor R5 a texel tilted 45 degrees comes out tilted slopeDeg degrees', () => {
    const forty5 = solidPicture(SIDE, encodeNormal(1, 0, 1));
    for (const degrees of [10, 30, 60, 80]) {
      const [r, g, b] = texelAt(reauthorNormal(forty5, mesh, { slopeDeg: degrees, seamRadius: 0, seamFlatten: 0 }), 150, 150) as [number, number, number];
      const x = (r - 128) / 127;
      const y = (g - 128) / 127;
      const z = (b - 128) / 127;
      const tiltDeg = (Math.atan2(Math.hypot(x, y), z) * 180) / Math.PI;
      expect(Math.abs(tiltDeg - degrees)).toBeLessThan(1.5);
    }
  });

  it('normal-reauthor R5 a flat base stays flat at every slope strength', () => {
    const flat = solidPicture(SIDE, FLAT);
    for (const degrees of [5, 80]) expect(texelAt(reauthorNormal(flat, mesh, { slopeDeg: degrees, seamRadius: 16, seamFlatten: 100 }), 150, 150)).toEqual(FLAT);
  });

  it('normal-reauthor R6 at 100 percent both sides of a seam are flat at the seam and untouched beyond the radius', () => {
    const result = reauthorNormal(base, mesh, { slopeDeg: 45, seamRadius: 16, seamFlatten: 100 });
    // A's seam is u = 0.4 (column 204.8), B's is u = 0.6 (column 307.2); rows 60..200 are inside both islands
    expect(maxDifference(texelAt(result, 204, 120), FLAT)).toBeLessThanOrEqual(3);
    expect(maxDifference(texelAt(result, 307, 120), FLAT)).toBeLessThanOrEqual(3);
    expect(maxDifference(texelAt(result, 150, 120), tilt)).toBeLessThanOrEqual(1); // 54 texels from the seam, radius 8
    expect(maxDifference(texelAt(result, 350, 120), tilt)).toBeLessThanOrEqual(1);
  });

  it('normal-reauthor R6 a lower flatten keeps the same fraction of slope on both sides', () => {
    const result = reauthorNormal(base, mesh, { slopeDeg: 45, seamRadius: 16, seamFlatten: 50 });
    const slopeOf = (column: number): number => {
      const [r, , b] = texelAt(result, column, 120) as [number, number, number];
      return (r - 128) / (b - 128);
    };
    const full = 0.5 / 0.866;
    expect(slopeOf(204)).toBeGreaterThan(0.4 * full);
    expect(slopeOf(204)).toBeLessThan(0.6 * full);
    expect(Math.abs(slopeOf(204) - slopeOf(307))).toBeLessThan(0.06);
  });

  it('normal-reauthor R8 outside the islands the picture is the nearest island texel, then flat beyond 16 texels per 1024', () => {
    // one island: columns 51 to 204 (uv 0.1..0.4 of 512); the base's old padding outside it is a loud colour that must never show through
    const padded = solidPicture(SIDE, [10, 20, 30, 255]);
    for (let row = 0; row < SIDE; row += 1) for (let column = 0; column <= 204; column += 1) padded.rgba.set(tilt, (row * SIDE + column) * 4);
    const result = reauthorNormal(padded, wall(0, [0.1, 0.1, 0.4, 0.4]), DEFAULT_PARAMS);
    expect(maxDifference(texelAt(result, 208, 120), tilt)).toBeLessThanOrEqual(1); // 3.7 texels out: the nearest island texel
    expect(texelAt(result, 215, 120)).toEqual(FLAT); // 11 texels out, the reach is 16 * 512 / 1024 = 8
    expect(texelAt(result, 5, 5)).toEqual(FLAT);
  });

  it('normal-reauthor R9 the same inputs give the same bytes, and the inputs are not changed', () => {
    const baseBefore = Array.from(base.rgba);
    const uvBefore = Array.from(mesh.uvs);
    const first = reauthorNormal(base, mesh, DEFAULT_PARAMS);
    const second = reauthorNormal(base, mesh, DEFAULT_PARAMS);
    expect(Array.from(second.rgba)).toEqual(Array.from(first.rgba));
    expect(Array.from(base.rgba)).toEqual(baseBefore);
    expect(Array.from(mesh.uvs)).toEqual(uvBefore);
    expect(first.side).toBe(SIDE);
  });

  it('normal-reauthor R9 a later release of the same params returns byte-identical pixels whatever was computed in between', () => {
    const params = { slopeDeg: 60, seamRadius: 8, seamFlatten: 70 };
    const first = reauthorNormal(base, mesh, params);
    reauthorNormal(base, mesh, DEFAULT_PARAMS);
    reauthorNormal(base, mesh, { slopeDeg: 10, seamRadius: 0, seamFlatten: 0 });
    expect(Array.from(reauthorNormal(base, mesh, params).rgba)).toEqual(Array.from(first.rgba));
  });

  it('normal-reauthor R9 an adopted picture (flatten 0, slope 45) equals its base inside the islands', () => {
    const result = reauthorNormal(base, mesh, ADOPTED_PARAMS);
    expect(maxDifference(texelAt(result, 150, 150), tilt)).toBeLessThanOrEqual(1);
  });

  it('normal-reauthor I9 every result vector has length 1 within 1/127 and a positive z, for random bases and params', () => {
    const random = seededRandom(99);
    const side = 64;
    for (let run = 0; run < 20; run += 1) {
      const randomBase: PixelPicture = solidPicture(side, FLAT);
      for (let at = 0; at < side * side; at += 1) randomBase.rgba.set(encodeNormal(random() * 2 - 1, random() * 2 - 1, 0.2 + random()), at * 4);
      const params = { slopeDeg: 5 + Math.floor(random() * 76), seamRadius: Math.round(random() * 32) / 2, seamFlatten: Math.floor(random() * 101) };
      const result = reauthorNormal(randomBase, twoWallsWithSeam(), params);
      for (let at = 0; at < side * side; at += 1) {
        const x = (result.rgba[at * 4]! - 128) / 127;
        const y = (result.rgba[at * 4 + 1]! - 128) / 127;
        const z = (result.rgba[at * 4 + 2]! - 128) / 127;
        expect(Math.abs(Math.hypot(x, y, z) - 1)).toBeLessThan(1.5 / 127);
        expect(z).toBeGreaterThan(0);
        expect(result.rgba[at * 4 + 3]).toBe(255);
      }
    }
  });

  it('normal-reauthor R9 E1 on a ramp of 98 base levels the steepest slopes stay monotone within 2 levels; 75 degrees keeps 64 distinct output levels, 80 degrees about 55 (open: test-plan risk 1)', () => {
    const side = 128;
    const ramp = solidPicture(side, FLAT);
    for (let column = 0; column < side; column += 1) {
      const x = (column / (side - 1)) * 0.77; // x code 128 to 226: 98 levels, z kept positive
      for (let row = 0; row < side; row += 1) ramp.rgba.set(encodeNormal(x, 0, Math.sqrt(1 - x * x)), (row * side + column) * 4);
    }
    const levelsAt = (slopeDeg: number): number[] => {
      const result = reauthorNormal(ramp, wall(0, [0, 0, 1, 1]), { slopeDeg, seamRadius: 0, seamFlatten: 0 });
      return Array.from({ length: side }, (_, column) => texelAt(result, column, 64)[0]!);
    };
    for (const slopeDeg of [75, 80]) {
      const levels = levelsAt(slopeDeg);
      levels.forEach((level, column) => {
        if (column > 0) expect(level).toBeGreaterThanOrEqual(levels[column - 1]! - 2);
      });
    }
    expect(new Set(levelsAt(75)).size).toBeGreaterThanOrEqual(64);
    expect(new Set(levelsAt(80)).size).toBeGreaterThanOrEqual(50); // below the 64 of the risk register: the user decides whether R4's cap becomes 75
  });

  it('normal-reauthor R11 a 1024 picture with the default params is re-authored well inside a generous bound (the budget is 1.5 s at 2048 on the reference machine)', () => {
    const big = solidPicture(1024, tilt);
    const started = performance.now();
    reauthorNormal(big, twoWallsWithSeam(), DEFAULT_PARAMS);
    expect(performance.now() - started).toBeLessThan(4000);
  });

  it('normal-reauthor R6 a mesh with no seams only gets the slope and the outside fill', () => {
    const result = reauthorNormal(base, wall(0, [0.1, 0.1, 0.4, 0.4]), { slopeDeg: 45, seamRadius: 16, seamFlatten: 100 });
    expect(maxDifference(texelAt(result, 204, 120), tilt)).toBeLessThanOrEqual(1);
  });
});
