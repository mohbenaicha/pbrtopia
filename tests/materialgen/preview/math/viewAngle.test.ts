import { describe, expect, it } from 'vitest';
import { pictureTurnOf } from '@mat/preview/math/viewAngle';

describe('materialgen/preview pictureTurnOf', () => {
  it('R72 the Plane shows its picture turned clockwise by the camera yaw, in degrees', () => {
    expect(pictureTurnOf({ mesh: 'plane', yaw: Math.PI / 2 })).toBeCloseTo(90, 6);
    expect(pictureTurnOf({ mesh: 'plane', yaw: -Math.PI / 4 })).toBeCloseTo(-45, 6);
    expect(pictureTurnOf({ mesh: 'plane', yaw: 0 })).toBe(0);
  });

  it('R72 a mesh that turns itself keeps the picker upright', () => {
    expect(pictureTurnOf({ mesh: 'ball', yaw: 1.2 })).toBe(0);
    expect(pictureTurnOf({ mesh: 'materialBall', yaw: -2 })).toBe(0);
  });
});
