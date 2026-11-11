import { describe, expect, it } from 'vitest';
import { DEFAULT_PREVIEW_VALUES } from '@mat/storage';
import { displacementFor } from '../../../../src/materialgen/preview/math/displacement';
import { defaultDistance } from '../../../../src/materialgen/preview/math/framing';
import { MESH_SEGMENTS, segmentsFor } from '../../../../src/materialgen/preview/math/meshSegments';
import { DEFAULT_POSE, DOLLY_MAX, DOLLY_MIN, dollyBy, isDefaultView, turnPose } from '../../../../src/materialgen/preview/math/turntable';

const values = (patch: Partial<typeof DEFAULT_PREVIEW_VALUES>) => ({ ...DEFAULT_PREVIEW_VALUES, ...patch });
/** What three.js adds to a vertex for a height texel h in 0..1. */
const moved = (h: number, d: { scale: number; bias: number }): number => h * d.scale + d.bias;

describe('materialgen/preview R15 R16 R17 displacement', () => {
  it('R15 height mid grey with level 0.5 does not move the vertex at any scale, contrast or tiling', () => {
    for (const patch of [{}, { heightScale: 0.1 }, { heightContrast: 3 }, { tilingX: 7, tilingY: 2 }]) {
      expect(moved(0.5, displacementFor(values(patch), true))).toBeCloseTo(0, 12);
    }
  });

  it('R15 a white pixel moves 0.01 out and a black pixel 0.01 in at scale 0.02, level 0.5, contrast 1, tiling 1', () => {
    const d = displacementFor(values({}), true);
    expect(moved(1, d)).toBeCloseTo(0.01, 12);
    expect(moved(0, d)).toBeCloseTo(-0.01, 12);
  });

  it('R15 R17 tiling 4 x 1 divides the movement by the average tiling 2.5 (0.5 * 0.02 / 2.5 = 0.004)', () => {
    expect(moved(1, displacementFor(values({ tilingX: 4, tilingY: 1 }), true))).toBeCloseTo(0.004, 12);
  });

  it('R15 an average tiling below 1 is not possible but the divisor never goes below 1', () => {
    expect(moved(1, displacementFor(values({ tilingX: 1, tilingY: 1 }), true))).toBeCloseTo(0.01, 12);
  });

  it('R16 with height missing nothing moves, whatever the scale, level and contrast', () => {
    const d = displacementFor(values({ heightScale: 0.1, heightLevel: 0, heightContrast: 3 }), false);
    expect(moved(1, d)).toBe(0);
    expect(moved(0, d)).toBe(0);
  });

  it('R16 level 1 with an all-white height moves nothing, level 0 moves by contrast * scale', () => {
    expect(moved(1, displacementFor(values({ heightLevel: 1 }), true))).toBeCloseTo(0, 12);
    expect(moved(1, displacementFor(values({ heightLevel: 0, heightContrast: 2, heightScale: 0.05 }), true))).toBeCloseTo(0.1, 12);
  });
});

describe('materialgen/preview R39 mesh resolution', () => {
  it('R39 levels 1 to 4 are 128, 256, 384 and 512 segments per side', () => {
    expect([1, 2, 3, 4].map(segmentsFor)).toEqual([128, 256, 384, 512]);
    expect(MESH_SEGMENTS).toEqual([128, 256, 384, 512]);
  });

  it('R39 an out-of-range level is clamped', () => {
    expect(segmentsFor(0)).toBe(128);
    expect(segmentsFor(9)).toBe(512);
    expect(segmentsFor(2.6)).toBe(384);
  });
});

describe('materialgen/preview R5 default distance', () => {
  const fov = 45;
  const visible = (distance: number, aspect: number, depth: number) => {
    const half = Math.tan((fov * Math.PI) / 360) * (distance - depth);
    return { height: half, width: half * aspect };
  };

  it.each([0.5, 1, 1.78, 3])('R5 the unit square keeps at least a 5%% margin of the smaller side at aspect %f', (aspect) => {
    const distance = defaultDistance({ halfWidth: 0.5, halfHeight: 0.5, halfDepth: 0 }, fov, aspect);
    const seen = visible(distance, aspect, 0);
    const marginOfSmallerSide = Math.min(seen.width - 0.5, seen.height - 0.5) / (2 * Math.min(seen.width, seen.height)); // seen is a half window, the side is twice that
    expect(marginOfSmallerSide).toBeGreaterThanOrEqual(0.05 - 1e-9);
  });

  it.each([0.5, 1, 1.78])('R5 the ball (radius 0.5, depth 0.5) keeps the margin at aspect %f', (aspect) => {
    const distance = defaultDistance({ halfWidth: 0.5, halfHeight: 0.5, halfDepth: 0.5 }, fov, aspect);
    const seen = visible(distance, aspect, 0.5);
    expect(Math.min(seen.width, seen.height) * 0.9).toBeGreaterThanOrEqual(0.5 - 1e-9); // 5% of the side free on both sides
  });
});

describe('materialgen/preview R20 R22 R23 turntable pose', () => {
  it('R20 a horizontal drag turns around the vertical axis, a vertical drag around the horizontal axis, and there is no roll', () => {
    const turned = turnPose(DEFAULT_POSE, 40, 0, 400);
    expect(turned.yaw).toBeGreaterThan(0);
    expect(turned.pitch).toBe(0);
    const tipped = turnPose(DEFAULT_POSE, 0, 40, 400);
    expect(tipped.pitch).toBeGreaterThan(0);
    expect(tipped.yaw).toBe(0);
    expect(Object.keys(turned).sort()).toEqual(['pitch', 'yaw']);
  });

  it('R20 a drag of zero length returns the very same pose object', () => {
    expect(turnPose(DEFAULT_POSE, 0, 0, 400)).toBe(DEFAULT_POSE);
  });

  it('R20 a drag across the whole smaller side turns the mesh by half a turn', () => {
    expect(turnPose(DEFAULT_POSE, 400, 0, 400).yaw).toBeCloseTo(Math.PI, 9);
  });

  it('R20 pitch stops at straight up and straight down so the mesh never flips over', () => {
    expect(turnPose(DEFAULT_POSE, 0, 100000, 400).pitch).toBeCloseTo(Math.PI / 2, 9);
    expect(turnPose(DEFAULT_POSE, 0, -100000, 400).pitch).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('R22 the wheel dolly stays between 0.4 and 3 times the default distance', () => {
    let factor = 1;
    for (let i = 0; i < 100; i += 1) factor = dollyBy(factor, 1);
    expect(factor).toBeCloseTo(DOLLY_MAX, 9);
    for (let i = 0; i < 200; i += 1) factor = dollyBy(factor, -1);
    expect(factor).toBeCloseTo(DOLLY_MIN, 9);
    expect([DOLLY_MIN, DOLLY_MAX]).toEqual([0.4, 3]);
  });

  it('R22 a wheel step that cannot move (already at the end) returns the same value', () => {
    expect(dollyBy(DOLLY_MAX, 1)).toBe(DOLLY_MAX);
  });

  it('R23 the default view is recognised, so a second Reset view changes nothing', () => {
    expect(isDefaultView(DEFAULT_POSE, 1)).toBe(true);
    expect(isDefaultView(turnPose(DEFAULT_POSE, 10, 0, 400), 1)).toBe(false);
    expect(isDefaultView(DEFAULT_POSE, 0.9)).toBe(false);
  });
});
