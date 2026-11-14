import { describe, expect, it } from 'vitest';
import type { Stamp } from '../../../../src/materialgen/compositing/plan/planStamps';
import { createStampQueue } from '../../../../src/materialgen/compositing/session/stampQueue';

const stamp = (size = 0.1, x = 0.5): Stamp => ({ shape: 0, invert: false, x, y: 0.5, size, angle: 0, strength: 1, hardness: 1 });
const stamps = (count: number, size = 0.1): Stamp[] => Array.from({ length: count }, (_, index) => stamp(size, index / 100));
// at side 1000 a stamp of size 0.1 costs 100 x 100 = 10 000 pixels

describe('materialgen/compositing stamp queue (R37)', () => {
  it('R37 stamps come out in order, as many as the pixel budget allows, and at least one', () => {
    const queue = createStampQueue({ side: 1000 });
    queue.push(1, stamps(10));
    const first = queue.take(35_000)!;
    expect(first.stamps.map((s) => s.x)).toEqual([0, 0.01, 0.02]);
    expect(first.finished).toBe(false);
    const tiny = queue.take(1)!;
    expect(tiny.stamps).toHaveLength(1);
    expect(queue.pending()).toBe(6);
  });

  it('R37 a stroke is finished when it is closed and its last stamp was taken; an open empty stroke waits', () => {
    const queue = createStampQueue({ side: 1000 });
    queue.push(1, stamps(2));
    expect(queue.take(1e9)).toMatchObject({ stroke: 1, finished: false });
    expect(queue.take(1e9)).toBeNull();
    queue.closeStroke(1);
    expect(queue.take(1e9)).toEqual({ stroke: 1, stamps: [], finished: true });
    expect(queue.take(1e9)).toBeNull();
    queue.push(2, stamps(3));
    queue.closeStroke(2);
    expect(queue.take(1e9)).toMatchObject({ stroke: 2, finished: true });
  });

  it('R37 a new stroke is queued behind the old one and a batch never mixes strokes', () => {
    const queue = createStampQueue({ side: 1000 });
    queue.push(1, stamps(2));
    queue.closeStroke(1);
    queue.push(2, stamps(2));
    const first = queue.take(1e9)!;
    expect([first.stroke, first.stamps.length, first.finished]).toEqual([1, 2, true]);
    expect(queue.take(1e9)).toMatchObject({ stroke: 2 });
  });

  it('R37 a stroke over 20 million stamp-pixels ignores further stamps and says so', () => {
    const queue = createStampQueue({ side: 1000, strokeCapPixels: 25_000 });
    expect(queue.push(1, stamps(2))).toEqual({ accepted: 2, tooMany: false });
    expect(queue.push(1, stamps(5))).toEqual({ accepted: 1, tooMany: true });
    expect(queue.push(1, stamps(1))).toEqual({ accepted: 0, tooMany: true });
    expect(queue.pending()).toBe(3);
    expect(queue.push(2, stamps(1))).toEqual({ accepted: 1, tooMany: false });
  });

  it('R37 dropping a stroke removes what is queued of it; clear removes everything', () => {
    const queue = createStampQueue({ side: 1000 });
    queue.push(1, stamps(3));
    queue.closeStroke(1);
    queue.push(2, stamps(4));
    queue.dropStroke(1);
    expect(queue.pending()).toBe(4);
    expect(queue.take(1e9)).toMatchObject({ stroke: 2 });
    queue.push(3, stamps(2));
    queue.clear();
    expect(queue.pending()).toBe(0);
    expect(queue.take(1e9)).toBeNull();
  });
});
