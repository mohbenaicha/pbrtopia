import { describe, expect, it } from 'vitest';
import { planMirror, type Quadrant } from '@mat/imageops';
import { cropTransform, mirrorTransform } from '@mat/app/panels/tools/toolTransformOf';

describe('materialgen/app toolTransformOf', () => {
  it('imageops R54 a crop rectangle in pixels of S becomes fractions of the picture', () => {
    expect(cropTransform({ x: 64, y: 32, width: 1920, height: 1984 }, 2048, null)).toEqual({
      kind: 'crop',
      rect: { x: 0.03125, y: 0.015625, width: 0.9375, height: 0.96875 },
      edge: null,
    });
  });

  it('imageops R55 the marked edge goes with the rectangle', () => {
    expect(cropTransform({ x: 0, y: 0, width: 2048, height: 2048 }, 2048, 'left')).toEqual({ kind: 'crop', rect: { x: 0, y: 0, width: 1, height: 1 }, edge: 'left' });
  });

  it('imageops R54 a mirror plan keeps, per result quadrant in the order TL TR BL BR, the source quadrant index and the flips', () => {
    const selection = new Set<Quadrant>(['TL', 'TR']);
    const transform = mirrorTransform(planMirror('pair', selection), selection);
    expect(transform.kind).toBe('mirror');
    if (transform.kind !== 'mirror') return;
    expect(transform.plan).toEqual([
      { from: 0, flipX: false, flipY: false },
      { from: 1, flipX: false, flipY: false },
      { from: 0, flipX: false, flipY: true },
      { from: 1, flipX: false, flipY: true },
    ]);
  });

  it('imageops R56 the selected quadrants are the marked ones, in the order TL TR BL BR', () => {
    const selection = new Set<Quadrant>(['BL']);
    const transform = mirrorTransform(planMirror('x', selection), selection);
    expect(transform).toMatchObject({ kind: 'mirror', marked: [false, false, true, false] });
  });

  it('imageops R56 no plan shows each quadrant as it is and still marks the selection', () => {
    expect(mirrorTransform(null, new Set<Quadrant>(['TR', 'BR']))).toEqual({ kind: 'mirror', plan: null, marked: [false, true, false, true] });
  });
});
