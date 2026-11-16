import type { WebGLRenderer, Texture } from 'three';
import type { JournalKind } from '../gpu/createStampPainter';
import { unionRect, type TexelRect } from '../gpu/stampGeometry';
import type { PaintSession } from '../session/createPaintSession';
import type { PaintedMap } from '../session/strokeLog';
import { createCloneLayer, type CloneLayer } from './gpu/createCloneLayer';
import { createEdgeFade, type EdgeFade } from './gpu/createEdgeFade';
import { createHighlightMask, type HighlightMask } from './gpu/createHighlightMask';
import { createLayerBaker, type LayerBaker } from './gpu/createLayerBaker';
import type { HighlightShape } from './gpu/cloneShaders';
import { reduceClone, flagsOf, INITIAL_CLONE_STATE, type CloneCommand, type CloneEvent, type CloneFlags, type CloneState } from './plan/cloneMachine';
import { createHighlightBounds, liftRect, type HighlightStamp } from './plan/highlightBounds';
import { fadeRadiusTexels, liftability } from './plan/liftLimits';
import { clampScale, copyRects, frameOf, isMoved, startPlacement, type CopyFrame, type Placement } from './plan/placement';
import { placementKinds } from './plan/placementKinds';

/** What the panel sets and the copy takes at placement (clone R3, R7, R22). */
export interface CloneSettings {
  shape: HighlightShape;
  hardness: number;
  strength: number;
}

export const DEFAULT_CLONE_SETTINGS: CloneSettings = { shape: 'round', hardness: 0.7, strength: 1 };

/** What the overlay draws of a floating copy. */
export interface FloatingView {
  colour: Texture;
  fade: Texture;
  frame: CopyFrame;
  placement: Placement;
  strength: number;
}

/** What the engine tells the mode about a confirmed copy. */
export type ConfirmResult = { applied: false } | { applied: true; undoable: boolean };

export interface CloneEngine {
  state(): CloneState;
  flags(): CloneFlags;
  settings(): CloneSettings;
  setSettings(patch: Partial<CloneSettings>): void;
  /** Adds stamps to the highlight; `size` is the brush size they were planned with. */
  paintHighlight(stamps: readonly HighlightStamp[]): void;
  /** The brush Size changed: the highlight may have become (un)liftable (clone R6). */
  sizeChanged(): void;
  /** Runs one event of the Highlight/Floating machine; returns the commands left for the mode (the pointer and the marker are its own). */
  send(event: CloneEvent): CloneCommand[];
  /** The copy's placement, or null while nothing floats. Set clamps the scale (R9a) and tells the machine whether the copy moved (R12). */
  placement(): Placement | null;
  setPlacement(next: Placement): void;
  floating(): FloatingView | null;
  maskTexture(): Texture | null;
  /** The result of the last `confirm` event, or null while none ran. */
  takeConfirmResult(): ConfirmResult | null;
  dispose(): void;
}

export interface CloneEngineOptions {
  renderer: WebGLRenderer;
  session: PaintSession;
  /** The brush Size now, as a fraction of the picture side (shared with Stamp, R22). */
  size(): number;
}

const mapsOf = (kinds: readonly JournalKind[]): PaintedMap[] => {
  const maps: PaintedMap[] = [];
  for (const kind of kinds) {
    if (kind === 'albedo') maps.push('albedo');
    else if (kind === 'orm') maps.push('rough', 'metal');
    else if (kind === 'height') maps.push('height');
    else if (!maps.includes('normal')) maps.push('normal');
  }
  return maps;
};

/**
 * Clone architecture C4, C5: everything about Clone that is not the pointer, the keys or the drawing of overlays. It owns the highlight (mask and box), the lifted
 * layer and its fade, the placement and the Highlight/Floating machine, and confirms through the session's placement port. No DOM; the GPU only through its modules.
 */
export function createCloneEngine(options: CloneEngineOptions): CloneEngine {
  const { renderer, session } = options;
  const { side } = session;
  const mask: HighlightMask = createHighlightMask(renderer, side);
  const bounds = createHighlightBounds();
  const fade: EdgeFade = createEdgeFade(renderer);
  const baker: LayerBaker = createLayerBaker(renderer);
  let state: CloneState = INITIAL_CLONE_STATE;
  let settings = DEFAULT_CLONE_SETTINGS;
  let layer: CloneLayer | null = null;
  let start: Placement | null = null;
  let current: Placement | null = null;
  let liftSize = 0;
  let confirmResult: ConfirmResult | null = null;

  // the padding uses the radius of Hardness 0, so Hardness can change while the copy floats (clone R8a, R10)
  const rectNow = () => {
    const box = bounds.box();
    return box === null ? null : liftRect(box, side, fadeRadiusTexels(0, options.size(), side));
  };
  const refreshLiftable = (): CloneEvent => ({ type: 'highlightChanged', hasHighlight: !bounds.isEmpty(), liftable: liftability(rectNow(), side) });
  const recomputeFade = (): void => {
    if (layer !== null && mask.texture() !== null) fade.compute(mask.texture()!, side, layer.rect, fadeRadiusTexels(settings.hardness, liftSize, side));
  };
  const release = (): void => {
    layer?.dispose();
    layer = null;
    fade.release();
    start = null;
    current = null;
  };

  const capture = (): void => {
    const rect = rectNow();
    if (rect === null || mask.texture() === null) return;
    session.finishPending(); // the copy sees the maps as the user sees them (clone R8)
    liftSize = options.size();
    layer = createCloneLayer(renderer, session.painter, rect);
    recomputeFade();
    start = startPlacement(rect, side);
    current = start;
  };

  const bake = (): void => {
    const lifted = layer;
    const placed = current;
    const edge = fade.texture();
    if (lifted === null || placed === null || edge === null) return;
    const painter = session.painter;
    const kinds = placementKinds({ height: painter.hasMap('height'), normal: painter.hasMap('normal') });
    const rects = copyRects(frameOf(lifted.rect, side), placed, side);
    const done = session.applyPlacement({
      maps: mapsOf(kinds),
      rects,
      kinds,
      draw: () => {
        baker.bake({ painter, layer: lifted, fade: edge, placement: placed, strength: settings.strength, kinds });
        return rects.reduce<TexelRect | null>((union, rect) => unionRect(union, rect), null);
      },
    });
    confirmResult = done === null ? { applied: false } : { applied: true, undoable: done.undoable };
    release();
  };

  const send = (event: CloneEvent): CloneCommand[] => {
    const step = reduceClone(state, event);
    state = step.state;
    const left: CloneCommand[] = [];
    for (const command of step.commands) {
      if (command === 'capture') capture();
      else if (command === 'bake') bake();
      else if (command === 'discard') release();
      else if (command === 'clearHighlight') {
        mask.clear();
        bounds.reset();
      } else left.push(command);
    }
    return left;
  };

  return {
    state: () => state,
    flags: () => flagsOf(state),
    settings: () => settings,
    setSettings(patch) {
      const hardnessChanged = patch.hardness !== undefined && patch.hardness !== settings.hardness;
      settings = { ...settings, ...patch };
      if (patch.strength !== undefined) send({ type: 'strengthChanged', strength: settings.strength });
      if (hardnessChanged) recomputeFade();
    },
    paintHighlight(stamps) {
      if (stamps.length === 0) return;
      mask.paint(stamps, settings.shape);
      for (const stamp of stamps) bounds.add(stamp);
      send(refreshLiftable());
    },
    sizeChanged: () => { if (state.phase === 'highlight') send(refreshLiftable()); },
    send,
    placement: () => current,
    setPlacement(next) {
      if (layer === null || start === null) return;
      const frame = frameOf(layer.rect, side);
      current = { ...next, scale: clampScale(frame, next.scale) };
      send({ type: 'placementChanged', moved: isMoved(start, current) });
    },
    floating: () => (layer === null || current === null || fade.texture() === null ? null
      : { colour: layer.colour, fade: fade.texture()!, frame: frameOf(layer.rect, side), placement: current, strength: settings.strength }),
    maskTexture: () => mask.texture(),
    takeConfirmResult() {
      const result = confirmResult;
      confirmResult = null;
      return result;
    },
    dispose() {
      release();
      mask.dispose();
      fade.dispose();
      baker.dispose();
    },
  };
}
