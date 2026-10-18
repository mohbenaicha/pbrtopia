import { MeshBasicMaterial, type Material } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createMaterialFlash } from '../../src/viewport/materialFlash';

function setup() {
  let now = 0;
  let callback: (() => void) | undefined;
  let requests = 0;
  const shown: (Material | null)[] = [];
  const flash = createMaterialFlash({
    show: (material) => shown.push(material),
    clock: {
      requestAnimationFrame: (next) => {
        callback = next;
        requests += 1;
        return requests;
      },
      cancelAnimationFrame: () => {
        callback = undefined;
      },
    },
    now: () => now,
  });
  return {
    flash,
    shown,
    requests: () => requests,
    advance(milliseconds: number): void {
      now += milliseconds;
      const run = callback;
      callback = undefined;
      run?.();
    },
  };
}

const material = new MeshBasicMaterial();

describe('material flash', () => {
  it('R17 it shows the material and takes it away three times, then leaves the normal look and finishes', async () => {
    const { flash, shown, advance } = setup();
    const done = vi.fn();
    void flash.start(material).then(done);
    expect(shown).toEqual([material]);
    for (let step = 0; step < 5; step += 1) advance(150);
    expect(shown).toEqual([material, null, material, null, material, null]);
    expect(done).not.toHaveBeenCalled(); // the last gap is still running
    advance(150);
    await Promise.resolve();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('R17 it asks for no frames once finished and none before it starts', () => {
    const { flash, requests, advance } = setup();
    expect(requests()).toBe(0);
    void flash.start(material);
    for (let step = 0; step < 6; step += 1) advance(150);
    const used = requests();
    advance(150);
    expect(requests()).toBe(used);
  });

  it('R17 a slow frame skips ahead to where the timeline is rather than replaying every flash', () => {
    const { flash, shown, advance } = setup();
    void flash.start(material);
    advance(760); // one late frame, already in the last gap
    expect(shown).toEqual([material, null]);
    advance(400); // past the end
    expect(shown).toEqual([material, null]);
  });

  it('R17 starting another flash replaces the one running, which finishes at once', async () => {
    const { flash, shown } = setup();
    const first = vi.fn();
    const other = new MeshBasicMaterial();
    void flash.start(material).then(first);
    void flash.start(other);
    await Promise.resolve();
    expect(first).toHaveBeenCalledTimes(1);
    expect(shown[shown.length - 1]).toBe(other);
  });

  it('R17 cancel and dispose put the normal look back and stop the frames', async () => {
    const { flash, shown, requests, advance } = setup();
    const done = vi.fn();
    void flash.start(material).then(done);
    flash.cancel();
    expect(shown[shown.length - 1]).toBeNull();
    await Promise.resolve();
    expect(done).toHaveBeenCalledTimes(1);
    const used = requests();
    advance(150);
    expect(requests()).toBe(used);
    void flash.start(material);
    flash.dispose();
    expect(shown[shown.length - 1]).toBeNull();
  });
});
