import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaintBridge } from '@mat/preview';
import type { PaintHost } from '../../../src/materialgen/preview/scene/paintHost';

const host = {} as PaintHost;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('materialgen/preview paint bridge, showMesh (compositing R55)', () => {
  it('R55 it resolves at once, without a change, when the mesh and a host are already there', async () => {
    const bridge = createPaintBridge();
    const changer = vi.fn();
    bridge.setMeshChanger(changer);
    bridge.publish({ host, mesh: 'plane' });
    await expect(bridge.showMesh('plane')).resolves.toBe(true);
    expect(changer).not.toHaveBeenCalled();
  });

  it('R55 it asks the preview to change the mesh and resolves once the new mesh and its host are published', async () => {
    const bridge = createPaintBridge();
    const changer = vi.fn();
    bridge.setMeshChanger(changer);
    bridge.publish({ host, mesh: 'ball' });
    let result: boolean | null = null;
    void bridge.showMesh('plane').then((value) => {
      result = value;
    });
    expect(changer).toHaveBeenCalledWith('plane');
    bridge.publish({ host: null, mesh: 'plane' }); // the scene is being rebuilt: no host yet
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toBeNull();
    bridge.publish({ host, mesh: 'plane' });
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toBe(true);
  });

  it('R55 it gives up with false when nobody can change the mesh, or when the change does not come in time', async () => {
    const bridge = createPaintBridge();
    bridge.publish({ host, mesh: 'ball' });
    await expect(bridge.showMesh('plane')).resolves.toBe(false); // no preview registered a changer
    bridge.setMeshChanger(vi.fn());
    const waiting = bridge.showMesh('plane', 1000);
    await vi.advanceTimersByTimeAsync(1001);
    await expect(waiting).resolves.toBe(false);
  });

  it('R55 a changer taken away is no longer called', async () => {
    const bridge = createPaintBridge();
    const changer = vi.fn();
    bridge.setMeshChanger(changer);
    bridge.setMeshChanger(null);
    bridge.publish({ host, mesh: 'ball' });
    await expect(bridge.showMesh('plane')).resolves.toBe(false);
    expect(changer).not.toHaveBeenCalled();
  });
});

describe('materialgen/preview paint bridge, shortcuts of the open tool (app/shortcuts R6)', () => {
  const set = { id: 'paint', entries: [{ keys: 'Alt + click', action: 'Set the line marker' }] };

  it('R6 there are none at first; the tool sets them, the preview publishing keeps them, and the listeners are told', () => {
    const bridge = createPaintBridge();
    const listener = vi.fn();
    bridge.subscribe(listener);
    expect(bridge.state().shortcuts).toBeNull();
    bridge.setShortcuts(set);
    expect(bridge.state().shortcuts).toBe(set);
    expect(listener).toHaveBeenCalledTimes(1);
    bridge.publish({ host, mesh: 'plane' });
    expect(bridge.state().shortcuts).toBe(set);
    expect(listener).toHaveBeenCalledTimes(2);
    bridge.setShortcuts(set); // the same set: nobody is told
    expect(listener).toHaveBeenCalledTimes(2);
    bridge.setShortcuts(null);
    expect(bridge.state().shortcuts).toBeNull();
  });
});
