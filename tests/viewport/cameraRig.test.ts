import { Box3, MathUtils, Sphere, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createCameraRig, resetViewDirection, viewDirectionForAxis, type ViewAxis } from '../../src/viewport/cameraRig';

const toward = (a: Vector3, b: Vector3): number => a.clone().normalize().dot(b.clone().normalize());

function screenVectors(direction: Vector3): { up: Vector3; right: Vector3 } {
  const rig = createCameraRig(1);
  rig.placeCamera(direction, 5);
  const camera = rig.perspective;
  return { up: new Vector3(0, 1, 0).applyQuaternion(camera.quaternion), right: new Vector3(1, 0, 0).applyQuaternion(camera.quaternion) };
}

describe('cameraRig', () => {
  it('R12 switching to orthographic keeps position, orientation and apparent size', () => {
    const rig = createCameraRig(1.5);
    rig.placeCamera(resetViewDirection(), 4);
    rig.setProjection('orthographic');
    expect(rig.active).toBe(rig.orthographic);
    expect(rig.orthographic.position.distanceTo(rig.perspective.position)).toBeCloseTo(0, 6);
    expect(rig.orthographic.quaternion.angleTo(rig.perspective.quaternion)).toBeCloseTo(0, 6);
    const visibleHeightAtTarget = 2 * 4 * Math.tan(MathUtils.degToRad(rig.perspective.fov) / 2);
    expect(rig.orthographic.top - rig.orthographic.bottom).toBeCloseTo(visibleHeightAtTarget, 5);
    expect((rig.orthographic.right - rig.orthographic.left) / (rig.orthographic.top - rig.orthographic.bottom)).toBeCloseTo(1.5, 5);
  });

  it('R12 the orthographic frustum follows the orbit distance after the camera moves', () => {
    const rig = createCameraRig(1);
    rig.placeCamera(resetViewDirection(), 4);
    rig.perspective.position.setLength(2);
    rig.syncOrthographic();
    expect(rig.orthographic.top - rig.orthographic.bottom).toBeCloseTo(2 * 2 * Math.tan(MathUtils.degToRad(rig.perspective.fov) / 2), 5);
  });

  it('R12 a new aspect ratio reaches both cameras', () => {
    const rig = createCameraRig(1);
    rig.placeCamera(resetViewDirection(), 4);
    rig.setAspect(2);
    expect(rig.perspective.aspect).toBe(2);
    expect((rig.orthographic.right - rig.orthographic.left) / (rig.orthographic.top - rig.orthographic.bottom)).toBeCloseTo(2, 5);
  });

  it('R12 setProjection reports whether the projection changed', () => {
    const rig = createCameraRig(1);
    expect(rig.setProjection('perspective')).toBe(false);
    expect(rig.setProjection('orthographic')).toBe(true);
    expect(rig.projection).toBe('orthographic');
  });

  it('R13 each axis view looks along its axis, with the screen-up and screen-right of architecture.md', () => {
    const cases: [ViewAxis, Vector3, Vector3 | null][] = [
      ['+x', new Vector3(1, 0, 0), new Vector3(0, 1, 0)],
      ['-x', new Vector3(-1, 0, 0), new Vector3(0, 1, 0)],
      ['+z', new Vector3(0, 0, 1), new Vector3(0, 1, 0)],
      ['-z', new Vector3(0, 0, -1), new Vector3(0, 1, 0)],
      ['+y', new Vector3(0, 1, 0), new Vector3(0, 0, -1)],
      ['-y', new Vector3(0, -1, 0), new Vector3(0, 0, 1)],
    ];
    for (const [axis, fromSide, expectedUp] of cases) {
      const direction = viewDirectionForAxis(axis);
      expect(toward(direction, fromSide), axis).toBeGreaterThan(0.99999);
      const { up, right } = screenVectors(direction);
      expect(up.angleTo(expectedUp!), `${axis} up`).toBeLessThan(0.01);
      if (axis === '+y' || axis === '-y') expect(right.angleTo(new Vector3(1, 0, 0)), `${axis} right`).toBeLessThan(0.01);
    }
  });

  it('R13 reset view looks from yaw 0.6, pitch 0.25', () => {
    const direction = resetViewDirection();
    expect(direction.length()).toBeCloseTo(1, 6);
    expect(direction.x).toBeCloseTo(Math.sin(0.6) * Math.cos(0.25), 6);
    expect(direction.y).toBeCloseTo(Math.sin(0.25), 6);
    expect(direction.z).toBeCloseTo(Math.cos(0.6) * Math.cos(0.25), 6);
  });

  it('R16 frameBounds centres the target and fits the bounds sphere in both fields of view', () => {
    for (const aspect of [2, 0.5]) {
      const rig = createCameraRig(aspect);
      rig.placeCamera(resetViewDirection(), 1);
      const box = new Box3(new Vector3(-1, 0, -3), new Vector3(3, 2, 1));
      rig.frameBounds(box);
      expect(rig.target.distanceTo(box.getCenter(new Vector3()))).toBeCloseTo(0, 6);
      const radius = box.getBoundingSphere(new Sphere()).radius;
      const distance = rig.distance();
      const halfVertical = MathUtils.degToRad(rig.perspective.fov) / 2;
      const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
      expect(Math.asin(radius / distance)).toBeLessThanOrEqual(Math.min(halfVertical, halfHorizontal) + 1e-6);
      expect(rig.radius).toBeCloseTo(radius, 6);
    }
  });

  it('R16 near, far and distance limits scale with the framed radius', () => {
    const small = createCameraRig(1);
    small.frameBounds(new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1)));
    const large = createCameraRig(1);
    large.frameBounds(new Box3(new Vector3(-100, -100, -100), new Vector3(100, 100, 100)));
    expect(large.perspective.far / small.perspective.far).toBeCloseTo(large.radius / small.radius, 4);
    expect(large.perspective.near / small.perspective.near).toBeCloseTo(large.radius / small.radius, 4);
    expect(large.distanceLimits().max / small.distanceLimits().max).toBeCloseTo(large.radius / small.radius, 4);
    expect(small.distanceLimits().min).toBeLessThan(small.distance());
    expect(small.distanceLimits().max).toBeGreaterThan(small.distance());
  });

  it('R16 before any model the radius is 1', () => {
    expect(createCameraRig(1).radius).toBe(1);
  });

  it('R16 an empty box leaves the framing unchanged', () => {
    const rig = createCameraRig(1);
    rig.placeCamera(resetViewDirection(), 4);
    rig.frameBounds(new Box3());
    expect(rig.distance()).toBeCloseTo(4, 6);
    expect(rig.radius).toBe(1);
  });
});
