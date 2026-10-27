import { MeshBasicMaterial, type Material } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createMaterialFlash } from '../../src/viewport/materialFlash';

function setup() {
  let now = 0;
  let callback: (() => void) | undefined;
  let requests = 0;
  const shown: { material: Material | null; opacity: number }[] = [];
  const flash = createMaterialFlash({
    show: (material) => shown.push({ material, opacity: material?.opacity ?? 0 }),
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

const PULSE_MS = 600;
const material = new MeshBasicMaterial({ transparent: true });

describe('material flash', () => {
  it('R16 it lays the material over the look at opacity 0 and raises and lowers the opacity smoothly three times, then takes it away and finishes', async () => {
    const { flash, shown, advance } = setup();
    const done = vi.fn();
    void flash.start(material).then(done);
    expect(shown).toEqual([{ material, opacity: 0 }]);
    for (let step = 0; step < 18; step += 1) advance(100); // three pulses of 600 ms in 100 ms steps
    const levels = shown.slice(1, -1).map((entry) => entry.opacity);
    const peaks = levels.filter((level, index) => level > (levels[index - 1] ?? 0) && level >= (levels[index + 1] ?? 0));
    expect(shown.slice(0, -1).every((entry) => entry.material === material)).toBe(true);
    expect(Math.max(...levels)).toBeCloseTo(1, 5);
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(0);
    expect(peaks).toHaveLength(3);
    expect(shown[shown.length - 1]).toEqual({ material: null, opacity: 0 });
    await Promise.resolve();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('R16 the opacity follows a smooth curve: no step between two frames 16 ms apart is bigger than a tenth', () => {
    const { flash, shown, advance } = setup();
    void flash.start(material);
    for (let step = 0; step < 100; step += 1) advance(16);
    const levels = shown.filter((entry) => entry.material !== null).map((entry) => entry.opacity);
    const biggestStep = Math.max(...levels.slice(1).map((level, index) => Math.abs(level - levels[index]!)));
    expect(biggestStep).toBeLessThan(0.1);
  });

  it('R16 one pulse lasts 600 ms: opacity 0 at the start, 1 half way, 0 again at the end of the pulse', () => {
    const { flash, shown, advance } = setup();
    void flash.start(material);
    advance(PULSE_MS / 2);
    expect(shown[shown.length - 1]!.opacity).toBeCloseTo(1, 5);
    advance(PULSE_MS / 2);
    expect(shown[shown.length - 1]!.opacity).toBeCloseTo(0, 5);
  });

  it('R16 it asks for no frames once finished and none before it starts', () => {
    const { flash, requests, advance } = setup();
    expect(requests()).toBe(0);
    void flash.start(material);
    for (let step = 0; step < 20; step += 1) advance(100);
    const used = requests();
    advance(100);
    expect(requests()).toBe(used);
  });

  it('R16 a slow frame skips ahead to where the timeline is rather than replaying the pulses', () => {
    const { flash, shown, advance } = setup();
    void flash.start(material);
    advance(PULSE_MS * 2 + PULSE_MS / 2); // one late frame, half way through the last pulse
    expect(shown[shown.length - 1]!.opacity).toBeCloseTo(1, 5);
    expect(shown).toHaveLength(2);
    advance(PULSE_MS); // past the end
    expect(shown[shown.length - 1]!.material).toBeNull();
  });

  it('R16 starting another flash replaces the one running, which finishes at once and is left at opacity 0', async () => {
    const { flash, shown, advance } = setup();
    const first = vi.fn();
    const other = new MeshBasicMaterial({ transparent: true });
    void flash.start(material).then(first);
    advance(PULSE_MS / 2);
    void flash.start(other);
    await Promise.resolve();
    expect(first).toHaveBeenCalledTimes(1);
    expect(material.opacity).toBe(0);
    expect(shown[shown.length - 1]!.material).toBe(other);
  });

  it('R16 cancel and dispose take the material away and stop the frames', async () => {
    const { flash, shown, requests, advance } = setup();
    const done = vi.fn();
    void flash.start(material).then(done);
    flash.cancel();
    expect(shown[shown.length - 1]!.material).toBeNull();
    await Promise.resolve();
    expect(done).toHaveBeenCalledTimes(1);
    const used = requests();
    advance(100);
    expect(requests()).toBe(used);
    void flash.start(material);
    flash.dispose();
    expect(shown[shown.length - 1]!.material).toBeNull();
  });
});
