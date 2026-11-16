/** A highlight stamp: the centre and the side of its (axis-aligned) square, in picture fractions. */
export interface HighlightStamp { x: number; y: number; size: number }

/** A box in unwrapped picture fractions (it may reach outside 0..1 when the highlight crosses an edge); an axis spanning the whole picture is exactly 0..1. */
export interface UnwrappedBox { x0: number; y0: number; x1: number; y1: number }

/** An integer texel rectangle with an unwrapped origin (it may start below 0 or end past the picture); `w` and `h` never exceed the picture side. */
export interface LiftRect { x: number; y: number; w: number; h: number }

export interface HighlightBounds {
  /** Adds a stamp; its centre is unwrapped to the copy of the picture nearest the previous stamp, so a drag across an edge stays one small box. O(1). */
  add(stamp: HighlightStamp): void;
  reset(): void;
  isEmpty(): boolean;
  box(): UnwrappedBox | null;
}

const nearest = (value: number, reference: number): number => value - Math.round(value - reference);
const EPSILON = 1e-6;

/**
 * Clone R8a: the bounding box of the highlight, from the stamps alone (never from pixels). Coordinates are unwrapped and anchored at the first stamp; an axis whose
 * span reaches the whole picture becomes the whole picture on that axis, so the box is never larger than one picture.
 */
export function createHighlightBounds(): HighlightBounds {
  let box: UnwrappedBox | null = null;
  let previous: { x: number; y: number } | null = null;
  return {
    add(stamp) {
      const x = previous === null ? stamp.x : nearest(stamp.x, previous.x);
      const y = previous === null ? stamp.y : nearest(stamp.y, previous.y);
      previous = { x, y };
      const half = stamp.size / 2;
      box = box === null
        ? { x0: x - half, y0: y - half, x1: x + half, y1: y + half }
        : { x0: Math.min(box.x0, x - half), y0: Math.min(box.y0, y - half), x1: Math.max(box.x1, x + half), y1: Math.max(box.y1, y + half) };
    },
    reset() {
      box = null;
      previous = null;
    },
    isEmpty: () => box === null,
    box() {
      if (box === null) return null;
      const full = (low: number, high: number): [number, number] => (high - low >= 1 - EPSILON ? [0, 1] : [low, high]);
      const [x0, x1] = full(box.x0, box.x1);
      const [y0, y1] = full(box.y0, box.y1);
      return { x0, y0, x1, y1 };
    },
  };
}

/** Clone R8a: the texel rectangle that is lifted: the box padded by `pad` texels (the fade radius) plus one, an axis that reaches the picture taken whole. */
export function liftRect(box: UnwrappedBox, side: number, pad: number): LiftRect {
  const axis = (low: number, high: number): [number, number] => {
    const from = Math.floor(low * side + EPSILON) - pad - 1;
    const to = Math.ceil(high * side - EPSILON) + pad + 1;
    return to - from >= side ? [0, side] : [from, to - from];
  };
  const [x, w] = axis(box.x0, box.x1);
  const [y, h] = axis(box.y0, box.y1);
  return { x, y, w, h };
}
