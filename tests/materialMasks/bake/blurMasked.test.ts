import { describe, expect, it } from 'vitest';
import { blurMasked } from '../../../src/materialMasks/bake/bakeMasks';
import { seededRandom } from '../../support/maskBakeFixtures';

type Edges = 'wrap' | 'clamp';

/** The window blur as it was before mask-bake-session R8: every masked texel sums the whole (2r+1)^2 window. The reference the separable blur must equal byte for byte. */
function blurMaskedByWindow(bytes: Uint8Array, masked: Uint8Array, width: number, height: number, radius: number, edges: Edges): Uint8Array {
  const reach = edges === 'wrap'
    ? (position: number, length: number): number => ((position % length) + length) % length
    : (position: number, length: number): number => Math.min(Math.max(position, 0), length - 1);
  const result = new Uint8Array(bytes.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (masked[y * width + x] !== 1) continue;
      let sum = 0;
      let weight = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const at = reach(y + dy, height) * width + reach(x + dx, width);
          if (masked[at] === 1) {
            sum += bytes[at]!;
            weight += 1;
          }
        }
      }
      result[y * width + x] = Math.round(sum / weight);
    }
  }
  return result;
}

const randomBytes = (random: () => number, length: number): Uint8Array => Uint8Array.from({ length }, () => Math.floor(random() * 256));
const randomMask = (random: () => number, length: number, density: number): Uint8Array => Uint8Array.from({ length }, () => (random() < density ? 1 : 0));

describe('blurMasked: the separable masked blur (mask-bake-session R8)', () => {
  it('mask-bake-session R8 equals the window blur byte for byte for random masks, wrap and clamp, radius 0 to 4', () => {
    const random = seededRandom(11);
    for (const [width, height] of [[1, 1], [3, 5], [7, 7], [16, 9], [31, 17]] as const) {
      for (const edges of ['wrap', 'clamp'] as const) {
        for (let radius = 0; radius <= 4; radius += 1) {
          for (const density of [0.2, 0.7, 1]) {
            const bytes = randomBytes(random, width * height);
            const masked = randomMask(random, width * height, density);
            const got = blurMasked(bytes, masked, width, height, radius, edges);
            const want = blurMaskedByWindow(bytes, masked, width, height, radius, edges);
            expect(Array.from(got), `${width}x${height} ${edges} r${radius} d${density}`).toEqual(Array.from(want));
          }
        }
      }
    }
  });

  it('mask-bake-session R8 a masked region of one value stays exactly that value', () => {
    const width = 20;
    const height = 12;
    const bytes = new Uint8Array(width * height).fill(173);
    const masked = new Uint8Array(width * height).fill(1);
    for (let index = 0; index < masked.length; index += 7) masked[index] = 0;
    for (const edges of ['wrap', 'clamp'] as const) {
      const result = blurMasked(bytes, masked, width, height, 4, edges);
      for (let index = 0; index < result.length; index += 1) expect(result[index]).toBe(masked[index] === 1 ? 173 : 0);
    }
  });

  it('mask-bake-session R8 the sums stay within 16 bits at radius 4 with every texel at 255', () => {
    const bytes = new Uint8Array(32 * 32).fill(255);
    const masked = new Uint8Array(32 * 32).fill(1);
    const result = blurMasked(bytes, masked, 32, 32, 4, 'wrap');
    expect(new Set(result)).toEqual(new Set([255]));
  });
});
