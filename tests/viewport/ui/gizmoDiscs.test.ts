import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { computeGizmoDiscs } from '../../../src/viewport/ui/gizmoDiscs';

const discAt = (quaternion: Quaternion, axis: string) => computeGizmoDiscs(quaternion, 40).find((disc) => disc.axis === axis)!;

describe('computeGizmoDiscs', () => {
  it('R13 a camera on +Z shows +X on the right, +Y up and +Z toward the viewer', () => {
    const identity = new Quaternion();
    expect(discAt(identity, '+x').x).toBeCloseTo(40);
    expect(discAt(identity, '+x').y).toBeCloseTo(0);
    expect(discAt(identity, '-x').x).toBeCloseTo(-40);
    expect(discAt(identity, '+y').y).toBeCloseTo(-40); // screen y grows downward
    expect(discAt(identity, '+z').depth).toBeCloseTo(1);
    expect(discAt(identity, '-z').depth).toBeCloseTo(-1);
  });

  it('R13 there is one disc for each of the six axes, labelled X, Y or Z, positive ones marked', () => {
    const discs = computeGizmoDiscs(new Quaternion(), 40);
    expect(discs.map((disc) => disc.axis).sort()).toEqual(['+x', '+y', '+z', '-x', '-y', '-z']);
    expect(discs.filter((disc) => disc.positive).map((disc) => disc.label).sort()).toEqual(['X', 'Y', 'Z']);
  });

  it('R13 the letters follow Blender Z-up naming: the vertical axis disc shows Z and the depth axis disc shows Y', () => {
    const labelOf = (axis: string): string => discAt(new Quaternion(), axis).label;
    expect([labelOf('+x'), labelOf('+y'), labelOf('+z')]).toEqual(['X', 'Z', 'Y']);
    expect([labelOf('-y'), labelOf('-z')]).toEqual(['Z', 'Y']);
  });

  it('R13 turning the camera to the +X side puts +Z on the left and -Z on the right', () => {
    const onPositiveX = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    expect(discAt(onPositiveX, '+z').x).toBeCloseTo(-40);
    expect(discAt(onPositiveX, '-z').x).toBeCloseTo(40);
    expect(discAt(onPositiveX, '+x').depth).toBeCloseTo(1);
  });

  it('R13 the disc nearest the viewer is listed last so it is drawn on top', () => {
    const discs = computeGizmoDiscs(new Quaternion(), 40);
    expect(discs[discs.length - 1]!.axis).toBe('+z');
    expect(discs[0]!.axis).toBe('-z');
  });
});
