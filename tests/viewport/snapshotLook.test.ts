import { Color, Scene } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createSnapshotLook } from '../../src/viewport/snapshotLook';

describe('createSnapshotLook', () => {
  it('generate R37 gives the viewport scene itself', () => {
    const scene = new Scene();
    expect(createSnapshotLook(scene, () => () => undefined).scene).toBe(scene);
  });

  it('generate R37 enter() hides the grid and takes the background off, and the function it returns puts both back', () => {
    const scene = new Scene();
    scene.background = new Color('#112233');
    const showGrid = vi.fn();
    const hideGrid = vi.fn(() => showGrid);
    const look = createSnapshotLook(scene, hideGrid);
    const leave = look.enter();
    expect(hideGrid).toHaveBeenCalledTimes(1);
    expect(scene.background).toBeNull();
    expect(showGrid).not.toHaveBeenCalled();
    leave();
    expect(showGrid).toHaveBeenCalledTimes(1);
    expect((scene.background as Color).getHexString()).toBe('112233');
  });

  it('generate R37 a scene with no background gets none back', () => {
    const scene = new Scene();
    const leave = createSnapshotLook(scene, () => () => undefined).enter();
    leave();
    expect(scene.background).toBeNull();
  });
});
