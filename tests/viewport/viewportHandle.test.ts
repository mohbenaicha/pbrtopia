// @vitest-environment jsdom
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createViewportHandle } from '../../src/viewport/viewportHandle';
import { createViewportEvents } from '../../src/viewport/viewportEvents';

function manualFrames() {
  let callback: (() => void) | undefined;
  let requests = 0;
  return {
    clock: {
      requestAnimationFrame: (next: () => void): number => {
        callback = next;
        requests += 1;
        return requests;
      },
      cancelAnimationFrame: (): void => {
        callback = undefined;
      },
    },
    runFrame(): void {
      const run = callback;
      callback = undefined;
      run?.();
    },
    requests: (): number => requests,
  };
}

function setup() {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientHeight', { value: 600 });
  const camera = new PerspectiveCamera(40, 800 / 600, 0.01, 100);
  camera.position.set(0, 0, 5);
  camera.updateMatrixWorld(true);
  const events = createViewportEvents();
  const pick = vi.fn(() => ({ point: new Vector3(0, 0, 1), normal: new Vector3(0, 0, 1) }));
  const frames = manualFrames();
  const handle = createViewportHandle({ canvas, camera: () => camera, pick, events, clock: frames.clock });
  return { canvas, camera, events, pick, frames, handle };
}

describe('viewport handle', () => {
  it('R17 it exposes the canvas element and passes picks through with the client position', () => {
    const { canvas, pick, handle } = setup();
    expect(handle.canvasElement).toBe(canvas);
    expect(handle.pickSurfacePoint(10, 20)).toEqual({ point: new Vector3(0, 0, 1), normal: new Vector3(0, 0, 1) });
    expect(pick).toHaveBeenCalledWith(10, 20);
  });

  it('R17 world radius and pixels are inverse using the canvas height and the camera now in use', () => {
    const { handle } = setup();
    const point = new Vector3(0, 0, 0);
    const radius = handle.worldRadiusAt(point, 60);
    expect(radius).toBeCloseTo((60 * 2 * 5 * Math.tan((20 * Math.PI) / 180)) / 600, 6);
    expect(handle.pixelsAt(point, radius)).toBeCloseTo(60, 4);
  });

  it('R17 camera changes in one frame reach the listeners once, with the direction the camera looks', () => {
    const { events, frames, handle, camera } = setup();
    const listener = vi.fn();
    handle.onCameraChange(listener);
    events.emit('camera-change');
    events.emit('camera-change');
    events.emit('camera-change');
    expect(listener).not.toHaveBeenCalled();
    frames.runFrame();
    expect(listener).toHaveBeenCalledTimes(1);
    const direction = listener.mock.calls[0]![0] as Vector3;
    expect(direction.x).toBeCloseTo(0);
    expect(direction.y).toBeCloseTo(0);
    expect(direction.z).toBeCloseTo(-1);
    camera.position.set(5, 0, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    events.emit('camera-change');
    frames.runFrame();
    expect(listener).toHaveBeenCalledTimes(2);
    expect((listener.mock.calls[1]![0] as Vector3).x).toBeCloseTo(-1);
  });

  it('R17 no frame is requested until the camera moves, and an unsubscribed listener hears nothing', () => {
    const { events, frames, handle } = setup();
    const listener = vi.fn();
    const stop = handle.onCameraChange(listener);
    expect(frames.requests()).toBe(0);
    stop();
    events.emit('camera-change');
    frames.runFrame();
    expect(listener).not.toHaveBeenCalled();
  });

  it('R17 after dispose camera changes are ignored', () => {
    const { events, frames, handle } = setup();
    const listener = vi.fn();
    handle.onCameraChange(listener);
    handle.dispose();
    events.emit('camera-change');
    frames.runFrame();
    expect(listener).not.toHaveBeenCalled();
  });
});
