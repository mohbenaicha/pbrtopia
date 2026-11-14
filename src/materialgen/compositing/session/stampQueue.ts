import type { Stamp } from '../plan/planStamps';

/** Compositing R37: 20 million stamp-pixels, roughly 1300 stamps of s = 0.12 at S = 2048. */
export const STROKE_CAP_PIXELS = 20_000_000;

export interface StampBatch {
  stroke: number;
  stamps: Stamp[];
  /** The stroke is closed and nothing of it is left to draw. */
  finished: boolean;
}

/** Compositing R37: stamps waiting for a frame, kept stroke by stroke so a batch never mixes strokes (the journal saves per stroke). */
export interface StampQueue {
  /** Queue stamps of a stroke; `tooMany` once the stroke passed its cap (the rest of it is ignored). */
  push(stroke: number, stamps: readonly Stamp[]): { accepted: number; tooMany: boolean };
  /** The pointer was released: the stroke gets no more stamps. */
  closeStroke(stroke: number): void;
  /** The oldest stroke's next stamps within the pixel budget (at least one), or null when nothing is ready. */
  take(budgetPixels: number): StampBatch | null;
  dropStroke(stroke: number): void;
  clear(): void;
  pending(): number;
}

interface QueuedStroke { id: number; stamps: Stamp[]; closed: boolean; pixels: number; capped: boolean }

export function createStampQueue(options: { side: number; strokeCapPixels?: number }): StampQueue {
  const cap = options.strokeCapPixels ?? STROKE_CAP_PIXELS;
  const costOf = (stamp: Stamp): number => (stamp.size * options.side) ** 2;
  let strokes: QueuedStroke[] = [];
  const find = (id: number): QueuedStroke => {
    let found = strokes.find((stroke) => stroke.id === id);
    if (found === undefined) { found = { id, stamps: [], closed: false, pixels: 0, capped: false }; strokes.push(found); }
    return found;
  };
  return {
    push: (id, stamps) => {
      const stroke = find(id);
      let accepted = 0;
      for (const stamp of stamps) {
        if (stroke.pixels >= cap) { stroke.capped = true; break; }
        stroke.pixels += costOf(stamp);
        stroke.stamps.push(stamp);
        accepted += 1;
      }
      if (accepted < stamps.length) stroke.capped = true;
      return { accepted, tooMany: stroke.capped };
    },
    closeStroke: (id) => { find(id).closed = true; },
    take: (budgetPixels) => {
      const front = strokes[0];
      if (front === undefined) return null;
      if (front.stamps.length === 0) {
        if (!front.closed) return null;
        strokes.shift();
        return { stroke: front.id, stamps: [], finished: true };
      }
      let spent = 0;
      let count = 0;
      while (count < front.stamps.length && (count === 0 || spent + costOf(front.stamps[count]!) <= budgetPixels)) { spent += costOf(front.stamps[count]!); count += 1; }
      const taken = front.stamps.splice(0, count);
      const finished = front.closed && front.stamps.length === 0;
      if (finished) strokes.shift();
      return { stroke: front.id, stamps: taken, finished };
    },
    dropStroke: (id) => { strokes = strokes.filter((stroke) => stroke.id !== id); },
    clear: () => { strokes = []; },
    pending: () => strokes.reduce((total, stroke) => total + stroke.stamps.length, 0),
  };
}
