import { describe, expect, it, vi } from 'vitest';
import type { ToolTransform } from '@mat/preview';
import { createToolLiveFeed } from '@mat/preview/ui/toolLiveFeed';

const seam = (depth: number): ToolTransform => ({ kind: 'seam', depth, profile: null });

/** A frame scheduler the test steps by hand. */
function manualFrames() {
  let queued: Array<() => void> = [];
  return {
    request: (frame: () => void) => queued.push(frame),
    cancel: () => { queued = []; },
    step: () => { const run = queued; queued = []; run.forEach((frame) => frame()); },
    pending: () => queued.length,
  };
}

describe('materialgen/preview toolLiveFeed', () => {
  it('R75 the newest transform is readable at once, but listeners hear nothing before the frame', () => {
    const frames = manualFrames();
    const feed = createToolLiveFeed(frames);
    const heard = vi.fn();
    feed.subscribe(heard);
    feed.push(seam(0.1));
    expect(feed.latest()).toEqual(seam(0.1));
    expect(heard).not.toHaveBeenCalled();
  });

  it('R75 fifty pushes inside one frame are one notification, and what the scene reads is the newest', () => {
    const frames = manualFrames();
    const feed = createToolLiveFeed(frames);
    const heard = vi.fn(() => feed.latest());
    feed.subscribe(heard);
    for (let tick = 1; tick <= 50; tick += 1) feed.push(seam(tick / 100));
    expect(frames.pending()).toBe(1); // one frame was asked for, not fifty
    frames.step();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard).toHaveReturnedWith(seam(0.5));
  });

  it('R75 fifty pushes over fifty frames are fifty notifications', () => {
    const frames = manualFrames();
    const feed = createToolLiveFeed(frames);
    const heard = vi.fn();
    feed.subscribe(heard);
    for (let tick = 1; tick <= 50; tick += 1) {
      feed.push(seam(tick / 100));
      frames.step();
    }
    expect(heard).toHaveBeenCalledTimes(50);
  });

  it('R75 clearing empties the feed and cancels the pending frame, so a later frame sets nothing', () => {
    const frames = manualFrames();
    const feed = createToolLiveFeed(frames);
    const heard = vi.fn();
    feed.subscribe(heard);
    feed.push(seam(0.2));
    feed.clear();
    expect(feed.latest()).toBeNull();
    expect(frames.pending()).toBe(0);
    frames.step();
    expect(heard).not.toHaveBeenCalled();
  });

  it('R75 a listener that unsubscribed hears nothing more, and a push after a frame asks for a new one', () => {
    const frames = manualFrames();
    const feed = createToolLiveFeed(frames);
    const heard = vi.fn();
    const stop = feed.subscribe(heard);
    feed.push(seam(0.3));
    frames.step();
    stop();
    feed.push(seam(0.4));
    expect(frames.pending()).toBe(1);
    frames.step();
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
