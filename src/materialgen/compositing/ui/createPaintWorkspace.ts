import type { PaintHost } from '@mat/preview';
import type { PaintedBytes, PaintSession } from '../session/createPaintSession';
import { createSurfacePointer, type SurfacePointer } from './createSurfacePointer';
import { isEditableTarget } from './brushGestures';
import type { ToolMode } from './toolMode';

/** What the panel shows of the session; a new object only when one of the fields changes. */
export interface PaintState {
  canUndo: boolean;
  canRedo: boolean;
  hasStrokes: boolean;
  notice: 'too-many-stamps' | 'too-large-to-undo' | null;
}

export interface PaintWorkspaceOptions {
  host: PaintHost;
  session: PaintSession;
  /** A lost graphics context ended the session (compositing R30). */
  onInterrupted(): void;
}

export interface PaintWorkspace {
  readonly host: PaintHost;
  readonly session: PaintSession;
  readonly surface: SurfacePointer;
  /** The mode that has the pointer and keys now; null detaches the current one. Switching drops the old mode's unconfirmed state (clone R1). */
  setMode(mode: ToolMode | null): void;
  /** Asks for an animation frame; the loop runs while the session has work or the mode is busy. */
  kick(): void;
  /** Tells the panel, when the state changed. */
  publish(): void;
  /** After a change made outside the frame loop (a placement, undo, redo): shows textures the session newly made, redraws, refreshes the height proxy and tells the panel. */
  afterEdit(): void;
  undo(): void;
  redo(): void;
  /** Done: draws what is queued and reads the painted maps (compositing R22). */
  readPainted(): PaintedBytes;
  state(): PaintState;
  subscribe(listener: () => void): () => void;
  /** Detaches the mode, puts the preview back as it was and frees the session. */
  dispose(): void;
}

/**
 * Clone architecture C1: what both tool modes share. It puts the session's textures in the preview (compositing R25), owns the frame loop, the surface pointer,
 * undo and redo, the turntable filter, the cursor and the lost-context report, and hands the pointer to one `ToolMode` at a time.
 */
export function createPaintWorkspace(options: PaintWorkspaceOptions): PaintWorkspace {
  const { host, session } = options;
  const { scene, element } = host;
  const surface = createSurfacePointer({ host, readProxy: (side) => session.readHeightProxy(side) });
  let mode: ToolMode | null = null;
  let shownKey = '';
  let frame = 0;
  let disposed = false;
  let snapshot: PaintState = { canUndo: false, canRedo: false, hasStrokes: false, notice: null };
  const listeners = new Set<() => void>();

  const publish = (): void => {
    const next: PaintState = { canUndo: session.canUndo(), canRedo: session.canRedo(), hasStrokes: session.hasStrokes(), notice: session.notice() };
    if (next.canUndo === snapshot.canUndo && next.canRedo === snapshot.canRedo && next.hasStrokes === snapshot.hasStrokes && next.notice === snapshot.notice) return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };

  // Compositing R25: the session's textures stand in for the stored ones; the height and normal ones appear the first time something needs them.
  const showTextures = (): void => {
    const textures = session.textures();
    const key = `${textures.height === null ? 0 : 1}${textures.normal === null ? 0 : 1}`;
    if (key === shownKey) return;
    shownKey = key;
    scene.setPaintTextures({ albedo: textures.albedo, orm: textures.orm, ...(textures.height === null ? {} : { height: textures.height }), ...(textures.normal === null ? {} : { normal: textures.normal }) });
  };

  const tick = (): void => {
    frame = 0;
    if (disposed) return;
    const result = session.step();
    if (result.painted) {
      showTextures();
      if (session.brush().height.on) surface.markDirty();
      host.invalidate();
      publish();
    }
    surface.refreshIfDue(result.more);
    mode?.onFrame?.();
    if (!result.more) publish();
    if (result.more || (mode?.isBusy() ?? false)) frame = requestAnimationFrame(tick);
  };
  const kick = (): void => {
    if (frame === 0 && !disposed) frame = requestAnimationFrame(tick);
  };

  const afterEdit = (): void => {
    showTextures();
    surface.markDirty();
    host.invalidate();
    publish();
  };
  const undo = (): void => {
    if (mode?.locksHistory?.() === true || !session.undo()) return;
    showTextures();
    surface.markDirty();
    surface.refresh();
    host.invalidate();
    publish();
    kick();
  };
  const redo = (): void => {
    if (mode?.locksHistory?.() === true || !session.redo()) return;
    showTextures();
    surface.markDirty();
    surface.refresh();
    host.invalidate();
    publish();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || isEditableTarget(event.target)) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
    else if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); redo(); }
  };
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    options.onInterrupted();
  };
  const onSurfaceChange = (): void => mode?.surfaceChanged();

  scene.setOrbitFilter({ ignoresPointer: (event) => event.button === 0 && event.pointerType !== 'touch', ignoresWheel: (event) => event.altKey });
  const previousCursor = element.style.cursor;
  element.style.cursor = 'crosshair';
  const stopFollowingSurface = scene.onValuesChange(onSurfaceChange);
  element.addEventListener('webglcontextlost', onContextLost);
  window.addEventListener('keydown', onKeyDown);
  showTextures();
  surface.refresh();

  return {
    host,
    session,
    surface,
    setMode(next) {
      if (next === mode || disposed) return;
      mode?.detach();
      mode = next;
      mode?.attach();
    },
    kick,
    publish,
    afterEdit,
    undo,
    redo,
    readPainted: () => session.readPainted(),
    state: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      mode?.detach();
      mode = null;
      stopFollowingSurface();
      element.removeEventListener('webglcontextlost', onContextLost);
      window.removeEventListener('keydown', onKeyDown);
      element.style.cursor = previousCursor;
      scene.setOrbitFilter(null);
      scene.setPaintTextures(null);
      session.dispose();
      listeners.clear();
    },
  };
}
