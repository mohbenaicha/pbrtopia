// @vitest-environment jsdom
import { Box3, MOUSE, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createCameraRig } from '../../src/viewport/cameraRig';
import { createOrbitControls } from '../../src/viewport/orbitControlsSetup';

function setup(onResetView: () => void = () => undefined) {
  const rig = createCameraRig(1);
  rig.placeCamera(new Vector3(0, 0, 1), 5);
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  return { rig, canvas, setup: createOrbitControls(rig, canvas, onResetView) };
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

  it('viewport-layout R16 a double-click on the canvas resets the view', () => {
    const onResetView = vi.fn();
    const { canvas, setup: orbit } = setup(onResetView);
    canvas.dispatchEvent(new MouseEvent('dblclick'));
    expect(onResetView).toHaveBeenCalledTimes(1);
    orbit.dispose();
  });

  it('viewport-layout R16 after dispose a double-click no longer resets the view', () => {
    const onResetView = vi.fn();
    const { canvas, setup: orbit } = setup(onResetView);
    orbit.dispose();
    canvas.dispatchEvent(new MouseEvent('dblclick'));
    expect(onResetView).not.toHaveBeenCalled();
  });
});
