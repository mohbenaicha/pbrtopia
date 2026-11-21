import { describe, expect, it } from 'vitest';
import { computeNormalFromHeight, type PixelImage } from '@mat/imageops';

const grey = (side: number, at: (x: number, y: number) => number): PixelImage => {
  const data = new Uint8Array(side * side);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) data[y * side + x] = at(x, y);
  return { width: side, height: side, channels: 1, data };
};
const texel = (image: PixelImage, x: number, y: number): [number, number, number] => {
  const o = (y * image.width + x) * 3;
  return [image.data[o]!, image.data[o + 1]!, image.data[o + 2]!];
};
const tiltOf = ([r, g, b]: [number, number, number]): number => {
  const nx = (r / 255) * 2 - 1;
  const ny = (g / 255) * 2 - 1;
  const nz = (b / 255) * 2 - 1;
  return (Math.acos(nz / Math.hypot(nx, ny, nz)) * 180) / Math.PI;
};
const shifted = (image: PixelImage, channels: number, dx: number, dy: number): Uint8Array => {
  const side = image.width;
  const out = new Uint8Array(image.data.length);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const from = (((y - dy + side) % side) * side + ((x - dx + side) % side)) * channels;
      out.set(image.data.subarray(from, from + channels), (y * side + x) * channels);
    }
  }
  return out;
};

describe('imageops normalFromHeight', () => {
  it('normal-from-height R5 a flat height map gives (128, 128, 255) everywhere, as a 3-channel S x S picture', () => {
    const result = computeNormalFromHeight(grey(16, () => 90), { blur: 1, strength: 45 });
    expect([result.width, result.height, result.channels]).toEqual([16, 16, 3]);
    for (let i = 0; i < 16 * 16; i += 1) expect([...result.data.subarray(i * 3, i * 3 + 3)]).toEqual([128, 128, 255]);
  });

  it('normal-from-height R5 a ramp rising toward the top tilts 45 degrees at Strength 45, leaning down (green below 128)', () => {
    // Rises a whole 4 levels per texel up the picture (y runs down), over a 64 tall picture: 252 levels, no wrap inside the ramp.
    const ramp = grey(64, (_x, y) => (63 - y) * 4);
    const result = computeNormalFromHeight(ramp, { blur: 0, strength: 45 });
    for (const y of [10, 20, 32, 50]) {
      const pixel = texel(result, 20, y);
      expect(Math.abs(tiltOf(pixel) - 45)).toBeLessThan(1);
      expect(pixel[1]).toBeLessThan(128);
      expect(Math.abs(pixel[0] - 128)).toBeLessThanOrEqual(1);
    }
  });

  it('normal-from-height R5 a height rising toward the right leans the normal left (red below 128), as OpenGL says', () => {
    const ramp = grey(64, (x) => x * 4);
    const pixel = texel(computeNormalFromHeight(ramp, { blur: 0, strength: 45 }), 30, 30);
    expect(pixel[0]).toBeLessThan(128);
    expect(Math.abs(pixel[1] - 128)).toBeLessThanOrEqual(1);
  });

  it('normal-from-height R5 the gain follows Strength: a steeper setting tilts more, on the same height', () => {
    const ramp = grey(64, (_x, y) => (63 - y) * 4);
    const tilt = (strength: number): number => tiltOf(texel(computeNormalFromHeight(ramp, { blur: 0, strength }), 20, 30));
    expect(Math.abs(tilt(20) - 20)).toBeLessThan(1);
    expect(Math.abs(tilt(70) - 70)).toBeLessThan(1);
  });

  it('normal-from-height R5 the result does not depend on the height map\'s contrast above the floor (the p95 gain)', () => {
    const high = grey(64, (_x, y) => (63 - y) * 4);
    const low = grey(64, (_x, y) => (63 - y) * 3); // 3 levels a texel is still above the 0.01 floor (3 / 255)
    const a = texel(computeNormalFromHeight(high, { blur: 0, strength: 45 }), 20, 30);
    const b = texel(computeNormalFromHeight(low, { blur: 0, strength: 45 }), 20, 30);
    expect(Math.abs(tiltOf(a) - tiltOf(b))).toBeLessThan(1);
  });

  it('normal-from-height R5 a nearly flat map is not blown up: the 0.01 floor keeps the tilt small', () => {
    // One level over 64 texels: slope far below the floor, so the tilt stays far under the chosen 45 degrees.
    const faint = grey(64, (_x, y) => (y < 32 ? 100 : 101));
    const result = computeNormalFromHeight(faint, { blur: 0, strength: 45 });
    let steepest = 0;
    for (let i = 0; i < 64 * 64; i += 1) steepest = Math.max(steepest, tiltOf([result.data[i * 3]!, result.data[i * 3 + 1]!, result.data[i * 3 + 2]!]));
    expect(steepest).toBeLessThan(15); // without the floor the same step would tilt the full 45
  });

  it('normal-from-height R5 the gain is read at the 95th percentile: a rare spike does not flatten everything else', () => {
    // A single sharp spike (1 texel in 4096) must not set the gain; the broad ramp still reaches its chosen tilt.
    const side = 64;
    const ramp = grey(side, (x, y) => (x === 40 && y === 10 ? 255 : (63 - y) * 3));
    const pixel = texel(computeNormalFromHeight(ramp, { blur: 0, strength: 45 }), 20, 40);
    expect(Math.abs(tiltOf(pixel) - 45)).toBeLessThan(2);
  });

  it('normal-from-height R5 a shift of the height with wrap gives the same shift of the result, byte for byte', () => {
    const side = 32;
    const bumpy = grey(side, (x, y) => Math.round(128 + 90 * Math.sin((x * 6.1) / side + (y * 4.3) / side) * Math.cos((y * 9.7) / side)));
    const base = computeNormalFromHeight(bumpy, { blur: 1.5, strength: 50 });
    const moved: PixelImage = { ...bumpy, data: shifted(bumpy, 1, 7, 13) };
    const result = computeNormalFromHeight(moved, { blur: 1.5, strength: 50 });
    expect([...result.data]).toEqual([...shifted(base, 3, 7, 13)]);
  });

  it('normal-from-height R5 the shift property also holds through the wrapped blur (S = 256, Blur 4 is a sigma of 1 px)', () => {
    const side = 256;
    const bumpy = grey(side, (x, y) => Math.round(128 + 90 * Math.sin((x * 6.1) / 37 + (y * 4.3) / 53) * Math.cos((y * 9.7) / 41)));
    const base = computeNormalFromHeight(bumpy, { blur: 4, strength: 50 });
    const moved: PixelImage = { ...bumpy, data: shifted(bumpy, 1, 11, 200) };
    expect([...computeNormalFromHeight(moved, { blur: 4, strength: 50 }).data]).toEqual([...shifted(base, 3, 11, 200)]);
  });

  it('normal-from-height R5 a tiling height gives a normal map with no seam: opposite edges read the same neighbours', () => {
    const side = 32;
    const wave = grey(side, (x) => Math.round(128 + 100 * Math.sin((2 * Math.PI * x) / side)));
    const result = computeNormalFromHeight(wave, { blur: 0, strength: 45 });
    // The wave is one period across, so the slope at x = 0 and x = side - 1 follows the wave: both sit near the same red value.
    expect(Math.abs(texel(result, 0, 5)[0] - texel(result, side - 1, 5)[0])).toBeLessThan(40);
    for (let y = 1; y < side; y += 1) expect(texel(result, 7, y)).toEqual(texel(result, 7, 0));
  });

  it('normal-from-height R5 Blur smooths: a noisy ramp tilts more evenly with Blur than without (sigma = blur * S / 1024)', () => {
    const side = 256; // at S = 256, Blur 4 is a sigma of 1 px
    const noisy = grey(side, (x, y) => Math.min(255, Math.max(0, 255 - y + ((x * 7919 + y * 104729) % 17) - 8)));
    const spread = (blur: number): number => {
      const result = computeNormalFromHeight(noisy, { blur, strength: 45 });
      const tilts: number[] = [];
      for (let y = 16; y < 240; y += 1) for (let x = 16; x < 240; x += 1) tilts.push(tiltOf(texel(result, x, y)));
      const mean = tilts.reduce((sum, value) => sum + value, 0) / tilts.length;
      return Math.sqrt(tilts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / tilts.length);
    };
    expect(spread(4)).toBeLessThan(spread(0));
  });

  it('normal-from-height R5 a result of an input is the same every time, and the input is not changed', () => {
    const input = grey(16, (x, y) => (x * 9 + y * 5) % 256);
    const copy = new Uint8Array(input.data);
    const first = computeNormalFromHeight(input, { blur: 1, strength: 45 });
    const second = computeNormalFromHeight(input, { blur: 1, strength: 45 });
    expect([...first.data]).toEqual([...second.data]);
    expect([...input.data]).toEqual([...copy]);
  });

  it('normal-from-height R5 the red channel is read when the height map has more channels', () => {
    const side = 16;
    const rgb = new Uint8Array(side * side * 3);
    for (let i = 0; i < side * side; i += 1) {
      rgb[i * 3] = ((i / side) | 0) * 8;
      rgb[i * 3 + 1] = 255;
      rgb[i * 3 + 2] = 3;
    }
    const fromRgb = computeNormalFromHeight({ width: side, height: side, channels: 3, data: rgb }, { blur: 0, strength: 45 });
    const fromGrey = computeNormalFromHeight(grey(side, (_x, y) => y * 8), { blur: 0, strength: 45 });
    expect([...fromRgb.data]).toEqual([...fromGrey.data]);
  });
});
