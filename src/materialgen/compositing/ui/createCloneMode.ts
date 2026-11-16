import type { Corner, Placement } from '../clone/plan/placement';
import { blockedReason, enterEvent, type ClonePhase } from '../clone/plan/cloneMachine';
import { beginDrag, dragTo, hitHandle, scaleByPointer, turnByWheel, type Drag } from '../clone/plan/dragPlacement';
import { layoutHandles } from '../clone/plan/handleLayout';
import { planHighlightLine, planHighlightMove, startHighlightStroke, type HighlightRun } from '../clone/plan/planHighlight';
import { createCloneEngine, DEFAULT_CLONE_SETTINGS, type CloneEngine, type CloneSettings } from '../clone/createCloneEngine';
import { BRUSH_CONTROLS, type BrushParams } from '../plan/brushParams';
import type { Point } from '../plan/planStamps';
import { resizeByPointer } from '../plan/resizeByPointer';
import { createModifierTracker, createResizeAnchor, createWheelNotches, isEditableTarget } from './brushGestures';
import { createCloneOverlay, type CloneOverlay } from './createCloneOverlay';
import { createHandleLayer, type HandleLayer } from './createHandleLayer';
import type { PaintWorkspace } from './createPaintWorkspace';
import type { ToolMode } from './toolMode';

/** What the panel shows of Clone (clone R6, R7, R12, R18): rebuilt only when one of the fields changes. */
export interface CloneView {
  phase: ClonePhase;
  canClone: boolean;
  canConfirm: boolean;
  cloneBlocked: 'empty' | 'too-large' | 'unmoved' | 'no-strength' | null;
  confirmBlocked: 'empty' | 'too-large' | 'unmoved' | 'no-strength' | null;
  /** The copy's scale in percent while one floats (replaces Size, clone R7); null otherwise. */
  scalePercent: number | null;
  settings: CloneSettings;
}

export interface CloneModeOptions {
  workspace: PaintWorkspace;
  /** The Alt movement changed the brush Size (clone R5): the panel shows it. */
  onBrushChange(brush: BrushParams): void;
}

export interface CloneMode extends ToolMode {
  view(): CloneView;
  subscribe(listener: () => void): () => void;
  /** The Clone button (clone R8): lifts the highlighted area into a floating copy. */
  lift(): void;
  /** The Confirm button (clone R12). */
  confirm(): void;
  setSettings(patch: Partial<CloneSettings>): void;
  /** The Scale slider while a copy floats, in percent (clone R7). */
  setScalePercent(percent: number): void;
  /** The brush Size changed in the panel: a highlight may stop or start being liftable (clone R6). */
  brushChanged(): void;
}

const MIN_BRUSH_SIZE = BRUSH_CONTROLS.size.min;

/**
 * Clone architecture C1, C4: the Clone tool mode. It turns the pointer, the wheel and the keys into engine calls (the engine holds the rules and the GPU work),
 * draws the overlay and the handles, and tells the panel what changed. Left button paints the highlight (Alt + click marker, Shift + click line) or, with a copy
 * floating, drags its handles; Esc, Enter and Alt + wheel are as clone R9, R12, R13.
 */
export function createCloneMode(options: CloneModeOptions): CloneMode {
  const { workspace } = options;
  const { session, surface, host } = workspace;
  const { scene, element } = host;
  const modifiers = createModifierTracker();
  const resize = createResizeAnchor();
  const wheel = createWheelNotches();
  const listeners = new Set<() => void>();
  let engine: CloneEngine | null = null;
  let overlay: CloneOverlay | null = null;
  let handles: HandleLayer | null = null;
  let settings: CloneSettings = DEFAULT_CLONE_SETTINGS; // kept while the tool stays open, across mode switches (clone R22)
  let run: HighlightRun | null = null; // a highlight stroke is open
  let drag: Drag | null = null;
  let marker: Point | null = null;
  let orbiting = false;
  let lastPoint: Point | null = null;
  let lastClient: { clientX: number; clientY: number } | null = null;
  let view: CloneView | null = null;

  const brushSize = (): number => Math.max(session.brush().size.value, MIN_BRUSH_SIZE);

  const computeView = (): CloneView => {
    const state = engine!.state();
    const flags = engine!.flags();
    const placed = engine!.placement();
    return {
      phase: state.phase, canClone: flags.canClone, canConfirm: flags.canConfirm,
      cloneBlocked: blockedReason(state, 'clone'), confirmBlocked: blockedReason(state, 'confirm'),
      scalePercent: placed === null ? null : Math.round(placed.scale * 100), settings,
    };
  };
  const emit = (): void => {
    if (engine === null) return;
    const next = computeView();
    const same = view !== null && JSON.stringify(view) === JSON.stringify(next);
    view = next;
    if (!same) for (const listener of [...listeners]) listener();
  };

  // ---- drawing -------------------------------------------------------------------------------------------------
  const tiling = (): { x: number; y: number } => ({ x: scene.paintSurface().tilingX, y: scene.paintSurface().tilingY });
  const toScreen = (point: Corner): { x: number; y: number } | null => {
    const { x, y } = tiling();
    const ndc = scene.planePoint(point.x / x - 0.5, point.y / y - 0.5, liftNow);
    if (ndc === null) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + ((ndc.ndcX + 1) / 2) * rect.width, y: rect.top + ((1 - ndc.ndcY) / 2) * rect.height };
  };
  let liftNow = 0;
  const setLift = (point: Point | null): void => {
    liftNow = surface.liftAt(point ?? { x: 0.5, y: 0.5 });
    overlay?.setLift(liftNow);
  };
  const layoutNow = () => {
    const floating = engine?.floating() ?? null;
    return floating === null ? null : layoutHandles(floating.frame, floating.placement, toScreen);
  };
  const updateBrush = (): void => {
    const showing = engine !== null && engine.state().phase === 'highlight' && lastPoint !== null && !orbiting;
    overlay?.showBrush(showing ? lastPoint : null, brushSize(), settings.shape);
    overlay?.showLine(showing && modifiers.shift() ? marker : null, showing && modifiers.shift() ? lastPoint : null); // clone R27
  };
  const refresh = (): void => {
    if (engine === null || overlay === null) return;
    overlay.showHighlight(engine.state().hasHighlight ? engine.maskTexture() : null);
    overlay.showFloating(engine.floating());
    overlay.setMarker(marker);
    updateBrush();
    handles?.show(layoutNow());
    emit();
  };

  // ---- actions -------------------------------------------------------------------------------------------------
  const endStroke = (): void => {
    if (run === null) return;
    run = null;
    engine?.send({ type: 'strokeEnded' });
    emit();
  };
  const endDrag = (): void => { drag = null; };
  const clearMarker = (): void => {
    marker = null;
    engine?.send({ type: 'markerCleared' });
  };
  const runCommands = (commands: readonly string[]): void => {
    if (commands.includes('endStroke')) endStroke();
    if (commands.includes('clearMarker')) clearMarker();
  };
  const afterConfirm = (): void => {
    const result = engine!.takeConfirmResult();
    if (result === null) return;
    workspace.afterEdit();
    workspace.kick();
  };
  const clone = (): void => {
    if (engine === null) return;
    engine.send({ type: 'clone' });
    setLift(engine.placement() === null ? lastPoint : { x: engine.placement()!.cx, y: engine.placement()!.cy });
    workspace.kick();
    refresh();
  };
  const confirm = (): void => {
    if (engine === null) return;
    engine.send({ type: 'confirm' });
    afterConfirm();
    refresh();
  };
  const escape = (): void => {
    if (engine === null) return;
    endDrag();
    runCommands(engine.send({ type: 'escape' }));
    refresh();
  };
  const moveCopy = (next: Placement): void => {
    engine?.setPlacement(next);
    refresh();
  };

  // ---- pointer -------------------------------------------------------------------------------------------------
  const onPointerDown = (event: PointerEvent): void => {
    if (event.button === 2) {
      orbiting = true; // the turntable takes the drag; the ghost steps aside
      updateBrush();
      return;
    }
    if (event.button !== 0 || event.pointerType === 'touch' || engine === null) return;
    modifiers.remember(event);
    const point = surface.pointAt(event);
    lastPoint = point;
    if (point === null) return; // off the plane or the picture
    event.preventDefault();
    if (engine.state().phase === 'floating') {
      if (event.altKey) return; // Alt + sideways scales the copy (clone R24); Alt + click never grabs a handle
      const layout = layoutNow();
      const placed = engine.placement();
      const hit = layout === null || placed === null ? null : hitHandle(layout, { x: event.clientX, y: event.clientY });
      if (hit !== null && placed !== null) {
        drag = beginDrag(hit, point, placed);
        element.setPointerCapture?.(event.pointerId);
      }
      return; // left-drag outside the copy does nothing (clone R23)
    }
    if (event.altKey) {
      marker = point;
      engine.send({ type: 'markerSet' });
      refresh();
      return;
    }
    const size = brushSize();
    if (event.shiftKey && marker !== null) {
      engine.paintHighlight(planHighlightLine(size, session.side, marker, point));
      marker = point;
      refresh();
      return;
    }
    if (run !== null) return;
    engine.send({ type: 'strokeStarted' });
    run = startHighlightStroke(size, session.side, point);
    element.setPointerCapture?.(event.pointerId);
    engine.paintHighlight(run.stamps);
    refresh();
  };

  // clone R5, R24: Alt held and no button down, the sideways movement resizes the ghost (compositing R73), or scales the floating copy
  const resizeWithAlt = (event: PointerEvent): void => {
    if (engine === null) return;
    const dx = resize.move(event, run !== null || drag !== null);
    if (dx === null) return;
    const floatingNow = engine.floating();
    const placed = engine.placement();
    if (floatingNow !== null && placed !== null) {
      const next = scaleByPointer(placed, floatingNow.frame, dx);
      if (next !== placed) moveCopy(next);
      return;
    }
    const current = session.brush();
    const next = resizeByPointer(current, dx);
    if (next === current) return;
    session.setBrush(next);
    engine.sizeChanged();
    options.onBrushChange(session.brush());
  };

  const onPointerMove = (event: PointerEvent): void => {
    modifiers.remember(event);
    if (engine === null) return;
    if (event.target !== element && run === null && drag === null) {
      lastPoint = null;
      lastClient = null;
      resize.reset();
      updateBrush();
      return;
    }
    resizeWithAlt(event);
    lastClient = { clientX: event.clientX, clientY: event.clientY };
    const point = surface.pointAt(event);
    lastPoint = point;
    if (point !== null) {
      if (drag !== null) moveCopy(dragTo(drag, point, engine.floating()!.frame));
      else if (run !== null) {
        run = planHighlightMove(run, point);
        engine.paintHighlight(run.stamps);
        workspace.kick();
      }
    }
    updateBrush();
    handles?.show(layoutNow());
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.button === 2) {
      orbiting = false;
      updateBrush();
      return;
    }
    if (event.button !== 0) return;
    endDrag();
    endStroke();
    refresh();
  };

  const onWheel = (event: WheelEvent): void => {
    if (!event.altKey) return; // the turntable dollies
    event.preventDefault();
    const notches = wheel.add(event.deltaY, event.deltaMode);
    const placed = engine?.placement() ?? null;
    if (notches === 0 || placed === null) return; // in Highlight Alt + wheel does nothing (clone R5)
    moveCopy(turnByWheel(placed, notches, event.shiftKey));
  };

  // ---- keys ----------------------------------------------------------------------------------------------------
  const onKeyDown = (event: KeyboardEvent): void => {
    modifiers.remember(event);
    if (engine === null || isEditableTarget(event.target)) return;
    if (event.key === 'Escape') escape();
    else if (event.key === 'Enter' && !event.repeat && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      if (enterEvent(engine.state()).type === 'confirm') confirm();
      else clone();
    } else updateBrush();
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    modifiers.remember(event);
    updateBrush();
  };
  const onBlur = (): void => {
    modifiers.clear();
    endDrag();
    endStroke();
    updateBrush();
  };
  const onLeave = (): void => {
    if (run !== null || drag !== null) return;
    lastPoint = null;
    lastClient = null;
    updateBrush();
  };

  const listen = (add: boolean): void => {
    const method = add ? 'addEventListener' : 'removeEventListener';
    element[method]('pointerdown', onPointerDown as EventListener);
    element[method]('pointerleave', onLeave);
    element[method]('wheel', onWheel as EventListener, add ? { passive: false } : undefined);
    window[method]('pointermove', onPointerMove as EventListener);
    window[method]('pointerup', onPointerUp as EventListener);
    window[method]('pointercancel', onPointerUp as EventListener);
    window[method]('keydown', onKeyDown as EventListener);
    window[method]('keyup', onKeyUp as EventListener);
    window[method]('blur', onBlur);
  };

  return {
    attach() {
      engine = createCloneEngine({ renderer: host.renderer, session, size: brushSize });
      engine.setSettings(settings);
      overlay = createCloneOverlay(scene.overlayRoot(), host.invalidate);
      handles = createHandleLayer();
      overlay.setTiling(tiling().x, tiling().y);
      setLift(null);
      listen(true);
      refresh();
    },
    detach() {
      endStroke();
      endDrag();
      if (engine !== null) engine.send({ type: 'modeLeft' }); // drops the copy and the highlight (clone R1)
      listen(false);
      overlay?.dispose();
      handles?.dispose();
      engine?.dispose();
      overlay = null;
      handles = null;
      engine = null;
      marker = null;
      lastPoint = null;
      lastClient = null;
      orbiting = false;
      view = null;
      resize.reset();
    },
    isBusy: () => run !== null || drag !== null || (engine?.state().phase === 'floating'),
    surfaceChanged() {
      overlay?.setTiling(tiling().x, tiling().y);
      setLift(lastClient === null ? lastPoint : (lastPoint = surface.pointAt(lastClient)));
      refresh();
    },
    locksHistory: () => engine?.state().phase === 'floating',
    onFrame: () => handles?.show(layoutNow()),
    view: () => view ?? (engine === null ? { phase: 'highlight', canClone: false, canConfirm: false, cloneBlocked: 'empty', confirmBlocked: null, scalePercent: null, settings } : computeView()),
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    lift: clone,
    confirm,
    setSettings(patch) {
      settings = { ...settings, ...patch };
      engine?.setSettings(patch);
      refresh();
    },
    setScalePercent(percent) {
      const placed = engine?.placement() ?? null;
      if (placed !== null) moveCopy({ ...placed, scale: percent / 100 });
    },
    brushChanged() {
      engine?.sizeChanged();
      refresh();
    },
  };
}
