// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { Quaternion, Vector3 } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import type { Projection } from '../../../src/viewport/cameraRig';
import { useCameraPose, type PoseSource } from '../../../src/viewport/ui/useCameraPose';

afterEach(cleanup);

// A viewport whose camera and projection the test moves and whose events it fires.
function fakeViewport() {
  const listeners = new Map<string, Set<() => void>>();
  const camera = { quaternion: new Quaternion() };
  const cameraRig = { projection: 'perspective' as Projection };
  const viewport = {
    camera,
    cameraRig,
    on: (event: string, listener: () => void) => {
      const set = listeners.get(event) ?? new Set<() => void>();
      listeners.set(event, set.add(listener));
      return () => set.delete(listener);
    },
  } as unknown as PoseSource;
  return { viewport, camera, cameraRig, emit: (event: string) => listeners.get(event)?.forEach((listener) => listener()), listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0) };
}

describe('useCameraPose', () => {
  it('R11 R12 it reports the camera\'s orientation and projection as they are now', () => {
    const fake = fakeViewport();
    const { result } = renderHook(() => useCameraPose(fake.viewport));
    expect(result.current.quaternion).toBe(fake.camera.quaternion);
    expect(result.current.projection).toBe('perspective');
  });

  it('R11 after a camera change it reads the new orientation, so the gizmo turns with the model', () => {
    const fake = fakeViewport();
    const { result } = renderHook(() => useCameraPose(fake.viewport));
    fake.camera.quaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    act(() => fake.emit('camera-change'));
    expect(result.current.quaternion).toBe(fake.camera.quaternion);
  });

  it('R12 after a projection change it reads the new projection, so the toggle shows the current icon', () => {
    const fake = fakeViewport();
    const { result } = renderHook(() => useCameraPose(fake.viewport));
    fake.cameraRig.projection = 'orthographic';
    act(() => fake.emit('projection-changed'));
    expect(result.current.projection).toBe('orthographic');
  });

  it('A6 it stops listening to the viewport when the view goes away', () => {
    const fake = fakeViewport();
    const { unmount } = renderHook(() => useCameraPose(fake.viewport));
    expect(fake.listenerCount()).toBe(2);
    unmount();
    expect(fake.listenerCount()).toBe(0);
  });
});
