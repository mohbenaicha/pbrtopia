// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ToolTransform } from '@mat/preview';
import { createToolLiveFeed } from '@mat/preview/ui/toolLiveFeed';
import { pickLiveTransform, useLiveToolFeed } from '@mat/preview/ui/useLiveToolTransform';
import type { ToolView } from '@mat/preview/ui/useToolViewRelease';

const seam = (depth: number): ToolTransform => ({ kind: 'seam', depth, profile: null });
const open = (depth: number, hold = false): ToolView => ({ transform: seam(depth), baseKeys: {}, hold });

function setup(view: ToolView | null, transform: ToolTransform | null) {
  let frames: Array<() => void> = [];
  const feed = createToolLiveFeed({ request: (frame) => frames.push(frame), cancel: () => { frames = []; } });
  const scene = { setToolTransform: vi.fn() };
  const renders = { count: 0 };
  const hook = renderHook(
    (props: { view: ToolView | null; transform: ToolTransform | null }) => {
      renders.count += 1;
      const shown = pickLiveTransform(props.view, feed, props.transform); // the viewport picks what the scene is built with, then subscribes the scene it got
      useLiveToolFeed(scene, props.view, feed);
      return shown;
    },
    { initialProps: { view, transform } },
  );
  const frame = (): void => { const run = frames; frames = []; run.forEach((step) => step()); };
  return { feed, scene, hook, frame, renders };
}

describe('materialgen/preview useLiveToolTransform', () => {
  it('R75 while the tool view is open, a frame of the feed sets the newest transform on the scene without any render', () => {
    const { feed, scene, frame, renders } = setup(open(0.225), seam(0.225));
    const before = renders.count;
    feed.push(seam(0.1));
    feed.push(seam(0.05));
    frame();
    expect(scene.setToolTransform).toHaveBeenCalledTimes(1);
    expect(scene.setToolTransform).toHaveBeenLastCalledWith(seam(0.05));
    expect(renders.count).toBe(before); // the hook's owner did not re-render
  });

  it('R75 a render that happens meanwhile gets the live transform, not the older one of the owner\'s state (a scene made late shows the newest)', () => {
    const { feed, hook } = setup(open(0.225), seam(0.225));
    feed.push(seam(0.07));
    hook.rerender({ view: open(0.225), transform: seam(0.225) });
    expect(hook.result.current).toEqual(seam(0.07));
  });

  it('R75 with no tool view, or a held one, the feed is ignored', () => {
    const closed = setup(null, null);
    closed.feed.push(seam(0.1));
    closed.frame();
    expect(closed.scene.setToolTransform).not.toHaveBeenCalled();
    expect(closed.hook.result.current).toBeNull();

    const held = setup(open(0.225, true), seam(0.225));
    held.feed.push(seam(0.1));
    held.frame();
    expect(held.scene.setToolTransform).not.toHaveBeenCalled();
    expect(held.hook.result.current).toEqual(seam(0.225));
  });

  it('R75 an empty feed leaves the owner\'s transform as it is', () => {
    const { hook } = setup(open(0.225), seam(0.225));
    expect(hook.result.current).toEqual(seam(0.225));
  });

  it('R75 no scene yet, or the hook gone, sets nothing', () => {
    const { feed, scene, hook, frame } = setup(open(0.225), seam(0.225));
    hook.unmount();
    feed.push(seam(0.1));
    frame();
    expect(scene.setToolTransform).not.toHaveBeenCalled();
  });
});
