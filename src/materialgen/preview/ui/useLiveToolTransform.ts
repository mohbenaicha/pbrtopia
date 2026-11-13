import { useEffect, useRef } from 'react';
import type { ToolTransform } from '../material/toolTransform';
import type { PreviewScene } from '../scene/createPreviewScene';
import type { ToolLiveFeed } from './toolLiveFeed';
import type { ToolView } from './useToolViewRelease';

const isLive = (view: ToolView | null): boolean => view !== null && !view.hold; // a held view is waiting for the committed maps and takes no more ticks

/** Imageops R75: what a scene made or updated by a render shows: the newest live transform while the tool view is open, else the owner's. */
export function pickLiveTransform(view: ToolView | null, live: ToolLiveFeed | undefined, transform: ToolTransform | null): ToolTransform | null {
  return live !== undefined && isLive(view) ? (live.latest() ?? transform) : transform;
}

/** Imageops R75: each frame of the feed puts the newest transform on the scene, with no render of the owner. Ignored while no tool view is open or while it is held. */
export function useLiveToolFeed(scene: Pick<PreviewScene, 'setToolTransform'> | null, view: ToolView | null, live: ToolLiveFeed | undefined): void {
  const open = useRef(isLive(view));
  open.current = isLive(view);
  useEffect(() => {
    if (scene === null || live === undefined) return undefined;
    return live.subscribe(() => {
      const newest = live.latest();
      if (newest !== null && open.current) scene.setToolTransform(newest);
    });
  }, [scene, live]);
}
