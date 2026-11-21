import { describe, expect, it } from 'vitest';
import { deriveNormals } from '../../../src/generation/normal/deriveNormals';
import type { PixelPicture, UprightSheet } from '../../../src/generation/normal/uprightTypes';
import { decodeNormal, pixelAt } from './meshFixtures';

const SIDE = 64;
const FROM = 12;
const TO = 52; // the piece covers texels FROM..TO-1 on both axes

function sheetWith(side = SIDE): UprightSheet {
  const mask = new Uint8Array(side * side);
  for (let y = FROM; y < TO; y += 1) for (let x = FROM; x < TO; x += 1) mask[y * side + x] = 1;
  return { picture: { side, rgba: new Uint8ClampedArray(side * side * 4) }, pieces: [], scale: 1, mask };
}

function heightFrom(f: (x: number, y: number) => number, side = SIDE): PixelPicture {
  const rgba = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const v = Math.round(Math.min(1, Math.max(0, f(x, y))) * 255);
      rgba.set([v, v, v, 255], (y * side + x) * 4);
    }
  }
  return { side, rgba };
}

const tiltDeg = (n: { z: number; x: number; y: number }): number => (Math.acos(n.z / Math.hypot(n.x, n.y, n.z)) * 180) / Math.PI;
const inside = (cb: (x: number, y: number) => void, margin = 0): void => {
  for (let y = FROM + margin; y < TO - margin; y += 1) for (let x = FROM + margin; x < TO - margin; x += 1) cb(x, y);
};

describe('deriveNormals', () => {
  it('normal-map R18 a flat height gives 128, 128, 255 everywhere', () => {
    const out = deriveNormals(heightFrom(() => 0.5), sheetWith());
    for (const [x, y] of [[0, 0], [30, 30], [FROM, FROM], [63, 63]] as const) expect(pixelAt(out, x, y)).toEqual([128, 128, 255]);
  });

  it('normal-map R18 a ramp gives a constant tilt of 45 degrees whatever its steepness', () => {
    for (const levelsPerTexel of [3, 4]) { // whole 8-bit levels per texel, so the ramp is exact; both slopes are above the 0.01 floor
      const out = deriveNormals(heightFrom((x) => (10 + x * levelsPerTexel) / 255), sheetWith());
      inside((x, y) => {
        const n = decodeNormal(out, x, y);
        expect(tiltDeg(n)).toBeGreaterThan(43.5);
        expect(tiltDeg(n)).toBeLessThan(46.5);
        expect(n.x).toBeLessThan(0); // height rises to the right, so the surface faces left
        expect(Math.abs(n.y)).toBeLessThan(0.03);
      }, 3);
    }
  });

  it('normal-map R18 the 95th percentile of the tilt is 45 degrees on a mixed relief', () => {
    const out = deriveNormals(heightFrom((x, y) => 0.5 + 0.2 * Math.sin(x / 3) * Math.cos(y / 5) + 0.05 * Math.sin(x * 1.3)), sheetWith());
    const tilts: number[] = [];
    inside((x, y) => tilts.push(tiltDeg(decodeNormal(out, x, y))));
    tilts.sort((a, b) => a - b);
    const p95 = tilts[Math.floor(tilts.length * 0.95)]!;
    expect(p95).toBeGreaterThan(43);
    expect(p95).toBeLessThan(47);
    expect(tilts[tilts.length - 1]!).toBeLessThan(80); // nothing tilts to 90
  });

  it('normal-map R18 every vector has length 1 and a positive blue', () => {
    const out = deriveNormals(heightFrom((x, y) => 0.5 + 0.3 * Math.sin(x / 2) * Math.sin(y / 4)), sheetWith());
    inside((x, y) => {
      const n = decodeNormal(out, x, y);
      expect(Math.abs(Math.hypot(n.x, n.y, n.z) - 1)).toBeLessThan(0.02);
      expect(n.z).toBeGreaterThan(0);
    });
  });

  it('normal-map R18 a height step at the piece border makes no cliff', () => {
    const out = deriveNormals(heightFrom((x, y) => (x >= FROM && x < TO && y >= FROM && y < TO ? 0.1 : 0.9)), sheetWith());
    inside((x, y) => expect(pixelAt(out, x, y)).toEqual([128, 128, 255]));
  });

  it('normal-map R18 an almost flat answer stays almost flat (the 0.01 floor)', () => {
    // up to two 8-bit levels of noise: slopes under 0.006, so the gain is 1 / 0.01 and not 1 / p95 (which would tilt the noise to 45 degrees)
    const out = deriveNormals(heightFrom((x, y) => (120 + ((x * 7 + y * 13) % 3)) / 255), sheetWith());
    let worst = 0;
    inside((x, y) => (worst = Math.max(worst, tiltDeg(decodeNormal(out, x, y)))));
    expect(worst).toBeLessThan(35);
  });

  it('normal-map R18 texels outside every piece are 128, 128, 255 and the image keeps the sheet side', () => {
    const out = deriveNormals(heightFrom((x) => x / SIDE), sheetWith());
    expect(out.side).toBe(SIDE);
    expect(pixelAt(out, 2, 2)).toEqual([128, 128, 255]);
    expect(out.rgba[(2 * SIDE + 2) * 4 + 3]).toBe(255);
  });

  it('normal-map R18 a colour answer is read as its luminance', () => {
    // a ramp that lives in one colour channel only: its slope is the channel's luminance weight times the ramp, and the tilt follows the floor rule
    const weights = [0.2126, 0.7152, 0.0722];
    weights.forEach((weight, channel) => {
      const rgba = new Uint8ClampedArray(SIDE * SIDE * 4);
      for (let y = 0; y < SIDE; y += 1) {
        for (let x = 0; x < SIDE; x += 1) {
          rgba.set([0, 0, 0, 255], (y * SIDE + x) * 4);
          rgba[(y * SIDE + x) * 4 + channel] = 3 * x;
        }
      }
      const n = decodeNormal(deriveNormals({ side: SIDE, rgba }, sheetWith()), 32, 32);
      const slope = (weight * 3) / 255;
      const expected = (Math.atan(Math.min(1, slope / 0.01)) * 180) / Math.PI;
      expect(Math.abs(tiltDeg(n) - expected)).toBeLessThan(1.5);
      expect(n.x).toBeLessThan(0);
    });
  });

  it('normal-map R20 the same inputs give the same normals', () => {
    const height = heightFrom((x, y) => 0.5 + 0.2 * Math.sin(x / 3 + y / 7));
    expect(Array.from(deriveNormals(height, sheetWith()).rgba)).toEqual(Array.from(deriveNormals(height, sheetWith()).rgba));
  });
});
