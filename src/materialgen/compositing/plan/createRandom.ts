/** Compositing R11, R71: a seeded generator whose state is a plain number, so drawing never mutates and a peek costs nothing (mulberry32). */

export function createSeed(seed: number): number {
  return seed >>> 0;
}

export interface Draw {
  value: number; // in [0, 1)
  state: number; // the state after this draw
}

export function drawFrom(state: number): Draw {
  const next = (state + 0x6d2b79f5) >>> 0;
  let mixed = Math.imul(next ^ (next >>> 15), 1 | next);
  mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
  return { value: ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296, state: next };
}
