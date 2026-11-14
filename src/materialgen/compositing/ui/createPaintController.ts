import type { PaintHost } from '@mat/preview';
import type { BrushAtlas } from '../atlas/readBrushAtlas';
import type { PaintMaterial } from '../gpu/paintMaterial';
import type { PainterMaps } from '../gpu/createStampPainter';
import { stepRotation, type BrushParams } from '../plan/brushParams';
import type { Point, ShapeSlot } from '../plan/planStamps';
import { createPaintSession, type PaintedBytes, type PaintSession } from '../session/createPaintSession';
import { createHeightProxy, pickSurface } from '../session/pickSurface';
import { createGhostOverlay, type GhostStamp } from './createGhostOverlay';

export interface PaintControllerOptions {
  host: PaintHost;
  atlas: BrushAtlas;
  maps: PainterMaps;
  side: number;
  material: PaintMaterial;
  shapes: readonly ShapeSlot[];
  brush: BrushParams;
  /** The wheel turned the stamp (R12): the panel shows the new angle, and Random rotation is off. */
  onBrushChange(brush: BrushParams): void;
  /** A lost graphics context ended the session (R30). */
  onInterrupted(): void;
}

/** What the panel shows of the session; a new object only when one of the fields changes. */
export interface PaintState {
  canUndo: boolean;
  canRedo: boolean;
  hasStrokes: boolean;
  notice: 'too-many-stamps' | 'too-large-to-undo' | null;
}

export interface PaintController {
  setBrush(brush: BrushParams): void;
  setShapes(shapes: readonly ShapeSlot[]): void;
  setMaterial(material: PaintMaterial): void;
  undo(): void;
  redo(): void;
  /** Done: draws what is queued and reads the painted maps (R22). */
  readPainted(): PaintedBytes;
  state(): PaintState;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

const PROXY_SIDE = 256; // R26: at most 512
const PROXY_INTERVAL_MS = 100;
const WHEEL_NOTCH = 100;
const LINE_UNITS = 33;
const GHOST_LIFT = 0.002; // the ghost sits a little above the surface it follows

const isEditable = (target: EventTarget | null): boolean => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Compositing A5: one painting session on the preview's Plane. Puts the session's textures in the preview, takes the pointer (left button paints, Alt + left sets
 * the line marker, Shift + left commits a line, Ctrl + wheel turns the stamp), draws a frame's share of stamps on every animation frame while work remains, keeps
 * the ghost and the height proxy the surface pick reads, and undoes and redoes with the keyboard. `dispose` puts the preview back as it was.
 */
export function createPaintController(options: PaintControllerOptions): PaintController {
  const { host, atlas, side } = options;
  const { scene, element } = host;
  const session: PaintSession = createPaintSession(host.renderer, {
    side, atlas: { data: atlas.data, width: atlas.width, height: atlas.height }, grid: atlas.grid, maps: options.maps, normalDirection: host.normalDirection(),
    material: options.material, shapes: options.shapes,
  });
  session.setBrush(options.brush);
  const ghost = createGhostOverlay(scene.overlayRoot(), session.atlasTexture(), atlas.grid, host.invalidate);
  let shapes = options.shapes;
  let material = options.material;
  let heightAt: (u: number, v: number) => number = () => 0.5;
  let heightProxyDirty = true;
  let lastProxyAt = 0;
  let shownKey = '';
  let stroking = false;
  let orbiting = false;
  let lastPoint: Point | null = null;
  let markerPoint: Point | null = null;
  let modifiers = { alt: false, shift: false };
  let wheelRemainder = 0;
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

  // R25: the session's textures stand in for the stored ones; the height and normal ones appear the first time a stamp needs them.
  const showTextures = (): void => {
    const textures = session.textures();
    const key = `${textures.height === null ? 0 : 1}${textures.normal === null ? 0 : 1}`;
    if (key === shownKey) return;
    shownKey = key;
    scene.setPaintTextures({ albedo: textures.albedo, orm: textures.orm, ...(textures.height === null ? {} : { height: textures.height }), ...(textures.normal === null ? {} : { normal: textures.normal }) });
  };

  const refreshHeightProxy = (): void => {
    const bytes = session.readHeightProxy(PROXY_SIDE);
    heightProxyDirty = false;
    lastProxyAt = performance.now();
    if (bytes !== null) heightAt = createHeightProxy(bytes, PROXY_SIDE);
  };

  const pointOf = (event: { clientX: number; clientY: number }): Point | null => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const ray = scene.planeRay(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
    if (ray === null) return null;
    const surface = scene.paintSurface();
    return pickSurface(ray.origin, ray.direction, { height: heightAt, ...surface });
  };
  const heightOf = (point: Point): number => {
    const surface = scene.paintSurface();
    return heightAt(point.x, point.y) * surface.scale + surface.bias + GHOST_LIFT;
  };

  const updateGhost = (): void => {
    const point = lastPoint;
    if (point === null || orbiting || shapes.length === 0) {
      ghost.hide();
      return;
    }
    const tint = material.albedo;
    if (modifiers.shift && session.hasLineMarker()) {
      ghost.show(session.ghostLine(point) as GhostStamp[], tint, heightOf(point));
      return;
    }
    const next = session.peekNext();
    if (next === null) {
      ghost.hide();
      return;
    }
    ghost.show([{ shape: next.shape, invert: next.invert, x: point.x, y: point.y, size: session.brush().size, angle: next.angle }], tint, heightOf(point));
  };
  const updateMarker = (): void => ghost.setMarker(markerPoint, markerPoint === null ? 0 : heightOf(markerPoint));

  const tick = (): void => {
    frame = 0;
    if (disposed) return;
    const result = session.step();
    if (result.painted) {
      showTextures();
      if (session.brush().height.on) heightProxyDirty = true;
      host.invalidate();
      publish();
    }
    if (heightProxyDirty && (!result.more || performance.now() - lastProxyAt >= PROXY_INTERVAL_MS)) refreshHeightProxy();
    if (!result.more) publish();
    if (result.more || stroking) frame = requestAnimationFrame(tick);
  };
  const kick = (): void => {
    if (frame === 0 && !disposed) frame = requestAnimationFrame(tick);
  };

  const endStroke = (): void => {
    if (!stroking) return;
    stroking = false;
    session.pointerUp();
    kick();
    publish();
  };

  const rememberModifiers = (event: { altKey: boolean; shiftKey: boolean }): void => {
    modifiers = { alt: event.altKey, shift: event.shiftKey };
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button === 2) {
      orbiting = true; // the turntable takes the drag (R4); the ghost steps aside
      updateGhost();
      return;
    }
    if (event.button !== 0 || event.pointerType === 'touch') return; // a touch never paints (R4)
    rememberModifiers(event);
    const point = pointOf(event);
    lastPoint = point;
    if (point === null) return; // off the plane or the picture (R32)
    event.preventDefault();
    if (event.altKey) {
      session.setLineMarker(point); // R13
      markerPoint = point;
      updateMarker();
      updateGhost();
      return;
    }
    if (event.shiftKey && session.hasLineMarker()) {
      session.commitLine(point);
      markerPoint = point;
      updateMarker();
      kick();
      publish();
      updateGhost();
      return;
    }
    if (shapes.length === 0 || stroking) return;
    stroking = true;
    element.setPointerCapture?.(event.pointerId);
    session.pointerDown(point);
    kick();
    publish();
    updateGhost();
  };

  const onPointerMove = (event: PointerEvent): void => {
    rememberModifiers(event);
    if (event.target !== element && !stroking) {
      lastPoint = null;
      ghost.hide();
      return;
    }
    const point = pointOf(event);
    lastPoint = point;
    if (stroking && point !== null) {
      session.pointerMove(point);
      kick();
    }
    updateGhost();
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.button === 2) {
      orbiting = false;
      updateGhost();
      return;
    }
    if (event.button === 0) endStroke();
  };

  const onWheel = (event: WheelEvent): void => {
    if (!event.ctrlKey) return; // the turntable dollies
    event.preventDefault();
    const units = event.deltaMode === 1 ? event.deltaY * LINE_UNITS : event.deltaY;
    if (units === 0) return;
    if (Math.sign(units) !== Math.sign(wheelRemainder)) wheelRemainder = 0;
    wheelRemainder += units;
    let notches = 0;
    while (Math.abs(wheelRemainder) >= WHEEL_NOTCH) {
      const direction = Math.sign(wheelRemainder);
      notches -= direction; // wheel up (negative delta) turns the angle up
      wheelRemainder -= direction * WHEEL_NOTCH;
    }
    if (notches === 0) return;
    const current = session.brush();
    const shown = session.peekNext();
    const from = current.randomRotation && shown !== null ? (shown.angle * 180) / Math.PI : current.rotation; // R12: continues from the ghost's angle
    const next: BrushParams = { ...current, randomRotation: false, rotation: stepRotation(from, notches, event.shiftKey) };
    session.setBrush(next);
    options.onBrushChange(session.brush());
    updateGhost();
  };

  const undo = (): void => {
    if (!session.undo()) return;
    showTextures();
    heightProxyDirty = true;
    refreshHeightProxy();
    host.invalidate();
    publish();
    kick();
  };
  const redo = (): void => {
    if (!session.redo()) return;
    showTextures();
    heightProxyDirty = true;
    refreshHeightProxy();
    host.invalidate();
    publish();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    rememberModifiers(event);
    if (event.key === 'Escape') {
      if (stroking) endStroke();
      else if (session.hasLineMarker()) {
        session.clearLineMarker();
        markerPoint = null;
        updateMarker();
      }
    } else if ((event.ctrlKey || event.metaKey) && !isEditable(event.target)) {
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
      else if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); redo(); }
    }
    updateGhost();
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    rememberModifiers(event);
    updateGhost();
  };
  const onBlur = (): void => {
    modifiers = { alt: false, shift: false }; // R38
    endStroke();
    updateGhost();
  };
  const onLeave = (): void => {
    if (stroking) return;
    lastPoint = null;
    ghost.hide();
  };
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    options.onInterrupted();
  };

  scene.setOrbitFilter({ ignoresPointer: (event) => event.button === 0 && event.pointerType !== 'touch', ignoresWheel: (event) => event.ctrlKey });
  const previousCursor = element.style.cursor;
  element.style.cursor = 'crosshair';
  ghost.setTiling(scene.paintSurface().tilingX, scene.paintSurface().tilingY);
  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointerleave', onLeave);
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('webglcontextlost', onContextLost);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  showTextures();
  refreshHeightProxy();

  return {
    setBrush(brush) {
      session.setBrush(brush);
      updateGhost();
    },
    setShapes(next) {
      shapes = next;
      session.setShapes(next);
      updateGhost();
    },
    setMaterial(next) {
      material = next;
      session.setMaterial(next);
      updateGhost();
    },
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
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointerleave', onLeave);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('webglcontextlost', onContextLost);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      element.style.cursor = previousCursor;
      scene.setOrbitFilter(null);
      scene.setPaintTextures(null);
      ghost.dispose();
      session.dispose();
      listeners.clear();
    },
  };
}
