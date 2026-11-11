import { useEffect } from 'react';
import type { ToolTransform } from '../material/toolTransform';

/**
 * Preview R58: the transform an open Crop or Mirror puts on the maps. `baseKeys` are the working keys of the maps when the tool opened; `hold` is set by Apply
 * (imageops R59) to keep the transform on the old maps until the committed maps are the ones shown, so the viewport never flashes the old map.
 */
export interface ToolView {
  transform: ToolTransform;
  baseKeys: Readonly<Record<string, string>>;
  hold: boolean;
}

/**
 * Preview R58, imageops R59: the transform the scene applies now. `keys` are the working keys of the maps now decoded (they arrive together with the maps). A held view
 * is released in the render in which every map it was set against has another key, and `onSettled` tells the owner to forget it.
 */
export function useToolViewRelease(view: ToolView | null, keys: Readonly<Record<string, string>>, onSettled: () => void): ToolTransform | null {
  const settled = view !== null && view.hold && Object.entries(view.baseKeys).every(([slot, base]) => keys[slot] !== base);
  useEffect(() => {
    if (settled) onSettled();
  }, [settled, view, onSettled]);
  return view === null || settled ? null : view.transform;
}
