import { describe, expect, it } from 'vitest';
import { QUADRANTS, availableMirrorModes, planMirror, type MirrorMode, type Quadrant } from '../../../../src/materialgen/imageops/geometry/mirrorPlan';

const set = (...quadrants: Quadrant[]): ReadonlySet<Quadrant> => new Set(quadrants);

describe('imageops mirror modes (R32)', () => {
  it('R32 the default selection TL and TR is a pair', () => {
    expect(availableMirrorModes(set('TL', 'TR'))).toEqual(['pair']);
  });

  it('R32 two adjacent quadrants allow pair; two diagonal quadrants allow nothing', () => {
    for (const adjacent of [['TL', 'BL'], ['TR', 'BR'], ['BL', 'BR']] as const) expect(availableMirrorModes(set(...adjacent))).toEqual(['pair']);
    expect(availableMirrorModes(set('TL', 'BR'))).toEqual([]);
    expect(availableMirrorModes(set('TR', 'BL'))).toEqual([]);
  });

  it('R32 one quadrant allows x, y and around', () => {
    for (const quadrant of QUADRANTS) expect(availableMirrorModes(set(quadrant))).toEqual(['x', 'y', 'around']);
  });

  it('R32 nothing, three or four quadrants allow no mode', () => {
    expect(availableMirrorModes(set())).toEqual([]);
    expect(availableMirrorModes(set('TL', 'TR', 'BL'))).toEqual([]);
    expect(availableMirrorModes(set('TL', 'TR', 'BL', 'BR'))).toEqual([]);
  });

  it('R32 a plan is refused for a mode the selection does not allow', () => {
    expect(planMirror('around' as MirrorMode, set('TL', 'TR'))).toBeNull();
    expect(planMirror('pair', set('TL'))).toBeNull();
  });

  it('R32 pair TL+TR: the bottom half becomes the reflection of the top half about the horizontal midline', () => {
    const plan = planMirror('pair', set('TL', 'TR'))!;
    expect(plan.TL).toEqual({ from: 'TL', flipX: false, flipY: false });
    expect(plan.TR).toEqual({ from: 'TR', flipX: false, flipY: false });
    expect(plan.BL).toEqual({ from: 'TL', flipX: false, flipY: true });
    expect(plan.BR).toEqual({ from: 'TR', flipX: false, flipY: true });
  });

  it('R32 pair TL+BL: the right half becomes the reflection of the left half about the vertical midline', () => {
    const plan = planMirror('pair', set('TL', 'BL'))!;
    expect(plan.TR).toEqual({ from: 'TL', flipX: true, flipY: false });
    expect(plan.BR).toEqual({ from: 'BL', flipX: true, flipY: false });
    expect(plan.TL.from).toBe('TL');
    expect(plan.BL.from).toBe('BL');
  });

  it('R32 pair BL+BR and TR+BR reflect into the opposite half', () => {
    const bottom = planMirror('pair', set('BL', 'BR'))!;
    expect(bottom.TL).toEqual({ from: 'BL', flipX: false, flipY: true });
    const right = planMirror('pair', set('TR', 'BR'))!;
    expect(right.TL).toEqual({ from: 'TR', flipX: true, flipY: false });
    expect(right.BL).toEqual({ from: 'BR', flipX: true, flipY: false });
  });

  it('R32 x: the horizontal neighbour is the reflection and the other two are untouched', () => {
    const plan = planMirror('x', set('TL'))!;
    expect(plan.TR).toEqual({ from: 'TL', flipX: true, flipY: false });
    expect(plan.TL.from).toBe('TL');
    expect(plan.BL).toEqual({ from: 'BL', flipX: false, flipY: false });
    expect(plan.BR).toEqual({ from: 'BR', flipX: false, flipY: false });
  });

  it('R32 y: the vertical neighbour is the reflection and the other two are untouched', () => {
    const plan = planMirror('y', set('BR'))!;
    expect(plan.TR).toEqual({ from: 'BR', flipX: false, flipY: true });
    expect(plan.TL).toEqual({ from: 'TL', flipX: false, flipY: false });
    expect(plan.BL).toEqual({ from: 'BL', flipX: false, flipY: false });
  });

  it('R32 around: the other three quadrants are reflections of the selected one', () => {
    const plan = planMirror('around', set('TR'))!;
    expect(plan.TL).toEqual({ from: 'TR', flipX: true, flipY: false });
    expect(plan.BR).toEqual({ from: 'TR', flipX: false, flipY: true });
    expect(plan.BL).toEqual({ from: 'TR', flipX: true, flipY: true });
    expect(plan.TR).toEqual({ from: 'TR', flipX: false, flipY: false });
  });
});
