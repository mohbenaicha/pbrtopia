import { Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createEnvironment, type EnvironmentEntry, type EnvironmentLoader } from '../../src/viewport/environment';
import { DEFAULT_VIEWPORT_SETTINGS, type ViewportSettings } from '../../src/viewport/viewportSettings';

interface Pending {
  id: string;
  resolve(entry: EnvironmentEntry): void;
  reject(error: Error): void;
}

// A loader whose requests finish when the test says so.
function manualLoader() {
  const pending: Pending[] = [];
  const dispose = vi.fn();
  const loader: EnvironmentLoader = {
    load: (id) => new Promise((resolve, reject) => pending.push({ id, resolve, reject })),
    dispose,
  };
  const entry = (withBackdrop: boolean): EnvironmentEntry => ({ light: new Texture(), backdrop: withBackdrop ? new Texture() : null });
  return { loader, pending, dispose, entry };
}

function manualClock() {
  let now = 0;
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
    now: (): number => now,
    advance(milliseconds: number): void {
      now += milliseconds;
      const run = callback;
      callback = undefined;
      run?.();
    },
    requests: (): number => requests,
  };
}

function setup(overrides: Partial<ViewportSettings> = {}) {
  const scene = new Scene();
  const invalidate = vi.fn();
  const onRotationSettled = vi.fn();
  const source = manualLoader();
  const time = manualClock();
  const environment = createEnvironment({ scene, loader: source.loader, invalidate, onRotationSettled, clock: time.clock, now: time.now });
  const settings = { ...DEFAULT_VIEWPORT_SETTINGS, ...overrides };
  return { scene, invalidate, onRotationSettled, source, time, environment, settings };
}

describe('environment', () => {
  it('R14 light intensity and rotation are written to the scene and a redraw is requested', () => {
    const { scene, invalidate, environment, settings } = setup();
    environment.applySettings({ ...settings, environmentIntensity: 2.5, environmentRotationDeg: 90 });
    expect(scene.environmentIntensity).toBe(2.5);
    expect(scene.environmentRotation.y).toBeCloseTo(Math.PI / 2);
    expect(scene.backgroundRotation.y).toBeCloseTo(Math.PI / 2);
    expect(invalidate).toHaveBeenCalled();
  });

  it('R14 the chosen HDRI becomes the scene light once it has loaded, and is only loaded once for the same choice', async () => {
    const { scene, source, environment, settings } = setup();
    environment.applySettings(settings);
    environment.applySettings({ ...settings, environmentIntensity: 2 });
    expect(source.pending.map((request) => request.id)).toEqual(['studio']);
    const studio = source.entry(false);
    source.pending[0]!.resolve(studio);
    await Promise.resolve();
    expect(scene.environment).toBe(studio.light);
  });

  it('R14 the background shows the HDRI only when it is switched on, and the built-in studio has none', async () => {
    const { scene, source, environment, settings } = setup();
    environment.applySettings({ ...settings, backgroundVisible: true });
    source.pending[0]!.resolve(source.entry(false));
    await Promise.resolve();
    expect(scene.background).toBeNull();

    environment.applySettings({ ...settings, hdri: 'venice_sunset', backgroundVisible: false });
    const venice = source.entry(true);
    source.pending[1]!.resolve(venice);
    await Promise.resolve();
    expect(scene.environment).toBe(venice.light);
    expect(scene.background).toBeNull();
    environment.applySettings({ ...settings, hdri: 'venice_sunset', backgroundVisible: true });
    expect(scene.background).toBe(venice.backdrop);
    environment.applySettings({ ...settings, hdri: 'venice_sunset', backgroundVisible: false });
    expect(scene.background).toBeNull();
  });

  it('R14 when two HDRIs are chosen quickly the last choice wins even if the first finishes later', async () => {
    const { scene, source, environment, settings } = setup();
    environment.applySettings({ ...settings, hdri: 'overcast_soil_puresky' });
    environment.applySettings({ ...settings, hdri: 'moonless_golf' });
    const second = source.entry(true);
    source.pending[1]!.resolve(second);
    await Promise.resolve();
    source.pending[0]!.resolve(source.entry(true));
    await Promise.resolve();
    expect(scene.environment).toBe(second.light);
  });

  it('R14 an HDRI that fails to load leaves the current light in place', async () => {
    const { scene, source, environment, settings } = setup();
    environment.applySettings(settings);
    const studio = source.entry(false);
    source.pending[0]!.resolve(studio);
    await Promise.resolve();
    environment.applySettings({ ...settings, hdri: 'missing' });
    source.pending[1]!.reject(new Error('404'));
    await Promise.resolve();
    await Promise.resolve();
    expect(scene.environment).toBe(studio.light);
  });

  it('R14 auto-rotate turns the light and backdrop at 14 degrees a second, one frame at a time, and only while on', () => {
    const { scene, invalidate, time, environment, settings } = setup();
    environment.applySettings({ ...settings, autoRotate: true });
    expect(time.requests()).toBe(1);
    time.advance(1000);
    expect(scene.environmentRotation.y).toBeCloseTo((14 * Math.PI) / 180);
    expect(scene.backgroundRotation.y).toBeCloseTo((14 * Math.PI) / 180);
    const calls = invalidate.mock.calls.length;
    time.advance(1000);
    expect(invalidate.mock.calls.length).toBeGreaterThan(calls);
    expect(time.requests()).toBe(3);

    environment.applySettings({ ...settings, autoRotate: false, environmentRotationDeg: 0 });
    const requests = time.requests();
    time.advance(1000);
    expect(time.requests()).toBe(requests);
  });

  it('R14 turning auto-rotate off keeps where the light stopped and reports it so it becomes the rotation setting', () => {
    const { scene, time, onRotationSettled, environment, settings } = setup({ environmentRotationDeg: 350 });
    environment.applySettings({ ...settings, autoRotate: true });
    time.advance(1000); // 350 + 14 wraps to 4
    environment.applySettings({ ...settings, autoRotate: false });
    expect(onRotationSettled).toHaveBeenCalledTimes(1);
    expect(onRotationSettled.mock.calls[0]![0]).toBeCloseTo(4);
    expect(scene.environmentRotation.y).toBeCloseTo((4 * Math.PI) / 180);
  });

  it('R14 dispose stops the spin, empties the scene light and backdrop and frees the loader', async () => {
    const { scene, source, time, environment, settings } = setup();
    environment.applySettings({ ...settings, autoRotate: true });
    source.pending[0]!.resolve(source.entry(true));
    await Promise.resolve();
    environment.dispose();
    const requests = time.requests();
    time.advance(1000);
    expect(time.requests()).toBe(requests);
    expect(scene.environment).toBeNull();
    expect(scene.background).toBeNull();
    expect(source.dispose).toHaveBeenCalledTimes(1);
  });

  it('R14 an HDRI that finishes loading after dispose is ignored', async () => {
    const { scene, source, environment, settings } = setup();
    environment.applySettings(settings);
    environment.dispose();
    source.pending[0]!.resolve(source.entry(false));
    await Promise.resolve();
    expect(scene.environment).toBeNull();
  });
});
