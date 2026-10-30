// @vitest-environment jsdom
import { Box3, MOUSE, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createCameraRig } from '../../src/viewport/cameraRig';
import { createOrbitControls } from '../../src/viewport/orbitControlsSetup';

function setup() {
  const rig = createCameraRig(1);
  rig.placeCamera(new Vector3(0, 0, 1), 5);
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  return { rig, canvas, setup: createOrbitControls(rig, canvas) };
}

describe('createOrbitControls', () => {
  it('viewport-layout R16 right button orbits, middle button pans, and the left button is left for the mode tools', () => {
    const { setup: orbit } = setup();
    expect(orbit.controls.mouseButtons.LEFT).toBeNull();
    expect(orbit.controls.mouseButtons.MIDDLE).toBe(MOUSE.PAN);
    expect(orbit.controls.mouseButtons.RIGHT).toBe(MOUSE.ROTATE);
    orbit.dispose();
  });

  it('viewport-layout R16 the controls drive the perspective camera of the rig and share its target object', () => {
    const { rig, setup: orbit } = setup();
    expect(orbit.controls.object).toBe(rig.perspective);
    expect(orbit.controls.target).toBe(rig.target);
    expect(orbit.controls.enableDamping).toBe(false);
    expect(orbit.controls.screenSpacePanning).toBe(true);
    orbit.dispose();
  });

  it('mode R20 the wheel zooms toward the point under the pointer', () => {
    const { setup: orbit } = setup();
    expect(orbit.controls.zoomToCursor).toBe(true);
    orbit.dispose();
  });

  it('viewport-layout R16 the zoom limits come from the rig, and applyDistanceLimits picks up a changed framing', () => {
    const { rig, setup: orbit } = setup();
    const first = rig.distanceLimits();
    expect([orbit.controls.minDistance, orbit.controls.maxDistance]).toEqual([first.min, first.max]);
    rig.frameBounds(new Box3(new Vector3(-50, -50, -50), new Vector3(50, 50, 50)));
    const second = rig.distanceLimits();
    expect(second.max).not.toBe(first.max);
    orbit.applyDistanceLimits();
    expect([orbit.controls.minDistance, orbit.controls.maxDistance]).toEqual([second.min, second.max]);
    orbit.dispose();
  });

  it('viewport-layout R16 a double-click on the canvas leaves the camera where it is', () => {
    const { rig, canvas, setup: orbit } = setup();
    rig.placeCamera(new Vector3(1, 0, 0), 2);
    const before = rig.perspective.position.clone();
    canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, button: 0 }));
    expect(rig.perspective.position.equals(before)).toBe(true);
    orbit.dispose();
  });
});
