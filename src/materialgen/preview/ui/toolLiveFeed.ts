import type { ToolTransform } from '../material/toolTransform';

/** Imageops R75: where the transforms of a dragged tool setting go, past the owner's state: the newest wins and is announced at most once per frame. */
export interface ToolLiveFeed {
  push(transform: ToolTransform): void;
  clear(): void; // forgets the newest transform and any frame asked for
  latest(): ToolTransform | null; // fresh at once, before the frame announces it
  subscribe(listener: () => void): () => void;
}

export interface FrameScheduler {
  request(frame: () => void): unknown;
  cancel(handle: unknown): void;
}

const BROWSER_FRAMES: FrameScheduler = {
  request: (frame) => requestAnimationFrame(frame),
  cancel: (handle) => cancelAnimationFrame(handle as number),
};

export function createToolLiveFeed(frames: FrameScheduler = BROWSER_FRAMES): ToolLiveFeed {
  let newest: ToolTransform | null = null;
  let asked = false;
  let handle: unknown;
  const listeners = new Set<() => void>();
  const announce = (): void => {
    asked = false;
    listeners.forEach((listener) => listener());
  };
  return {
    push(transform) {
      newest = transform;
      if (asked) return; // a frame is already coming; it will carry the newest
      asked = true;
      handle = frames.request(announce);
    },
    clear() {
      newest = null;
      if (asked) frames.cancel(handle);
      asked = false;
    },
    latest: () => newest,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
