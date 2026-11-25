import { describe, expect, it } from 'vitest';
import { buildWorkingHeight } from '../../../../src/generation/normal/height/buildWorkingHeight';
import { prepareSharpness } from '../../../../src/generation/normal/height/prepareSharpness';
import { measureSlope, soleIslandHeight } from './heightFixtures';

// E1: the definitive narrowing test (test-plan section 2). The real functions, pooled window extremes included, on shapes whose slope size W (10-90% rise width,
// in texels) is known. Every case prints its numbers so the result can be read, not only passed.
const SIDE = 512;
const CENTRE = SIDE / 2;
const AMOUNTS = [0.5, 1, 1.5, 2] as const;
const WIDTH_BOUND: Record<number, number> = { 0.5: 0.95, 1: 0.9, 1.5: 0.88, 2: 0.85 };
const SIZES = [8, 32, 100];

type Shape = { name: string; height: (size: number) => (x: number, y: number) => number; line: (at: (x: number, y: number) => number) => number[]; step: number };
const tanhScale = (size: number): number => size / 2.197; // tanh reaches 0.1 and 0.9 at +-1.0986 scale units
const SHAPES: Shape[] = [
  {
    name: 'disc edge',
    height: (size) => (x, y) => 0.5 * (1 - Math.tanh((Math.hypot(x - CENTRE, y - CENTRE) - 150) / tanhScale(size))),
    line: (at) => Array.from({ length: 200 }, (_, i) => at(CENTRE + 50 + i, CENTRE)),
    step: 1,
  },
  {
    name: 'ramp at 45 degrees',
    height: (size) => (x, y) => 0.5 * (1 + Math.tanh(((x + y) / Math.SQRT2 - SIDE / Math.SQRT2) / tanhScale(size))),
    line: (at) => Array.from({ length: 200 }, (_, i) => at(CENTRE + i - 100, CENTRE + i - 100)),
    step: Math.SQRT2,
  },
];

function widthAndPeakByAmount(shape: Shape, size: number): Record<number, { width: number; peak: number }> {
  const source = shape.height(size);
  const picture = soleIslandHeight(SIDE, source);
  const deltas = prepareSharpness(picture);
  const sample = (working: Float32Array) => shape.line((x, y) => working[Math.min(SIDE - 1, Math.max(0, y)) * SIDE + Math.min(SIDE - 1, Math.max(0, x))]!);
  const result: Record<number, { width: number; peak: number }> = {};
  for (const amount of [0, ...AMOUNTS]) result[amount] = measureSlope(sample(buildWorkingHeight(picture, deltas, amount)), shape.step);
  return result;
}

describe('Sharpness narrows slopes (E1)', () => {
  for (const shape of SHAPES) {
    for (const size of SIZES) {
      it(`normal-height-edit R5.3 (E1) ${shape.name}, size ${size}: the slope width falls as the amount rises, within the bounds`, () => {
        const measured = widthAndPeakByAmount(shape, size);
        const base = measured[0]!;
        const ratios = AMOUNTS.map((amount) => measured[amount]!.width / base.width);
        console.log(`E1 ${shape.name} W=${size} width ratio at 0.5/1/1.5/2: ${ratios.map((r) => r.toFixed(2)).join(' / ')}; peak ratio: ${AMOUNTS.map((a) => (measured[a]!.peak / base.peak).toFixed(2)).join(' / ')}`);
        AMOUNTS.forEach((amount, i) => expect(ratios[i]!).toBeLessThanOrEqual(WIDTH_BOUND[amount]!));
        for (let i = 1; i < ratios.length; i += 1) expect(ratios[i]!).toBeLessThan(ratios[i - 1]!);
      });

      it(`normal-height-edit R5.4 (E1) ${shape.name}, size ${size}: the slope gets steeper`, () => {
        const measured = widthAndPeakByAmount(shape, size);
        const base = measured[0]!;
        expect(measured[0.5]!.peak / base.peak).toBeGreaterThanOrEqual(1.05);
        expect(measured[1]!.peak / base.peak).toBeGreaterThanOrEqual(1.1);
        expect(measured[2]!.peak).toBeGreaterThan(measured[1]!.peak);
      });
    }

    for (const size of [2, 3]) {
      it(`normal-height-edit R5.5 (E1) ${shape.name}, size ${size}: a slope at the grid's limit is never widened`, () => {
        const measured = widthAndPeakByAmount(shape, size);
        for (const amount of AMOUNTS) expect(measured[amount]!.width / measured[0]!.width).toBeLessThanOrEqual(1.02);
      });
    }
  }

  it('normal-height-edit R5.6 (E1) a gentle ramp (3 grey levels over 200 texels) does not gain a contour step', () => {
    const levels = (x: number): number => Math.round(3 * Math.min(1, Math.max(0, (x - 156) / 200))) / 255;
    const quantised = soleIslandHeight(SIDE, (x) => levels(x));
    const smooth = new Float32Array(SIDE * SIDE); // [1 2 1] twice on each axis, like the app's own smoothing
    for (let y = 0; y < SIDE; y += 1) {
      for (let x = 0; x < SIDE; x += 1) {
        const a = quantised.smoothed[y * SIDE + Math.max(0, x - 2)]!;
        const b = quantised.smoothed[y * SIDE + Math.max(0, x - 1)]!;
        const c = quantised.smoothed[y * SIDE + x]!;
        const d = quantised.smoothed[y * SIDE + Math.min(SIDE - 1, x + 1)]!;
        const e = quantised.smoothed[y * SIDE + Math.min(SIDE - 1, x + 2)]!;
        smooth[y * SIDE + x] = (a + 4 * b + 6 * c + 4 * d + e) / 16;
      }
    }
    const picture = { ...quantised, smoothed: smooth };
    const deltas = prepareSharpness(picture);
    const peakOf = (working: Float32Array): number => {
      let peak = 0;
      for (let x = 1; x < SIDE - 1; x += 1) peak = Math.max(peak, Math.abs((working[CENTRE * SIDE + x + 1]! - working[CENTRE * SIDE + x - 1]!) / 2));
      return peak;
    };
    const base = peakOf(smooth);
    for (const amount of [1, 2]) {
      const ratio = peakOf(buildWorkingHeight(picture, deltas, amount)) / base;
      console.log(`E1 gentle ramp peak ratio at ${amount}: ${ratio.toFixed(3)}`);
      expect(ratio).toBeLessThanOrEqual(1.1);
    }
  });
});
