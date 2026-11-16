import type { PaintMaterial } from '../gpu/paintMaterial';
import type { AtlasGrid } from '../gpu/stampGeometry';
import { stepRotation, updateBrushValue, type BrushParams } from '../plan/brushParams';
import { resizeByPointer } from '../plan/resizeByPointer';
import type { Point, ShapeSlot } from '../plan/planStamps';
import { createModifierTracker, createResizeAnchor, createWheelNotches } from './brushGestures';
import { createGhostOverlay, type GhostOverlay, type GhostStamp } from './createGhostOverlay';
import type { PaintWorkspace } from './createPaintWorkspace';
import { followSurface } from './followSurface';
import type { ToolMode } from './toolMode';

export interface StampModeOptions {
  workspace: PaintWorkspace;
  /** The shape atlas the ghost draws from. */
  atlasGrid: AtlasGrid;
  material: PaintMaterial;
  shapes: readonly ShapeSlot[];
  /** The wheel or the Alt movement changed the brush (compositing R12, R73): the panel shows it. */
  onBrushChange(brush: BrushParams): void;
}

export interface StampMode extends ToolMode {
  setBrush(brush: BrushParams): void;
  setShapes(shapes: readonly ShapeSlot[]): void;
  setMaterial(material: PaintMaterial): void;
}

/**
 * Compositing A5, the Stamp tool mode: takes the pointer (left button paints, Alt + left sets the line marker, Shift + left commits a line, Alt + wheel turns the
 * stamp, Alt + moving sideways resizes it), and shows the ghost. The frame loop, undo and redo, textures and the height proxy are the workspace's.
 */
export function createStampMode(options: StampModeOptions): StampMode {
  const { workspace } = options;
  const { session, surface, host } = workspace;
  const { scene, element } = host;
  const modifiers = createModifierTracker();
  const resize = createResizeAnchor();
  const wheel = createWheelNotches();
  let ghost: GhostOverlay | null = null;
  let shapes = options.shapes;
  let material = options.material;
  let stroking = false;
  let orbiting = false;
  let lastPoint: Point | null = null;
  let lastClient: { clientX: number; clientY: number } | null = null; // the pointer over the canvas, to pick the ghost's point again when the surface changes (R56)
  let markerPoint: Point | null = null;

  const updateGhost = (): void => {
    if (ghost === null) return;
    const point = lastPoint;
    if (point === null || orbiting || shapes.length === 0) {
      ghost.hide();
      return;
    }
    const tint = material.albedo;
    if (modifiers.shift() && session.hasLineMarker()) {
      ghost.show(session.ghostLine(point) as GhostStamp[], tint, surface.liftAt(point));
      return;
    }
    const next = session.peekNext();
    if (next === null) {
      ghost.hide();
      return;
    }
    ghost.show([{ shape: next.shape, invert: next.invert, x: point.x, y: point.y, size: next.size, angle: next.angle }], tint, surface.liftAt(point));
  };
  const updateMarker = (): void => ghost?.setMarker(markerPoint, markerPoint === null ? 0 : surface.liftAt(markerPoint));

  const endStroke = (): void => {
    if (!stroking) return;
    stroking = false;
    session.pointerUp();
    workspace.kick();
    workspace.publish();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button === 2) {
      orbiting = true; // the turntable takes the drag (R4); the ghost steps aside
      updateGhost();
      return;
    }
    if (event.button !== 0 || event.pointerType === 'touch') return; // a touch never paints (R4)
    modifiers.remember(event);
    const point = surface.pointAt(event);
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
      workspace.kick();
      workspace.publish();
      updateGhost();
      return;
    }
    if (shapes.length === 0 || stroking) return;
    stroking = true;
    element.setPointerCapture?.(event.pointerId);
    session.pointerDown(point);
    workspace.kick();
    workspace.publish();
    updateGhost();
  };

  // R73: with Alt held (not Shift, the straight line, nor Ctrl, Undo) and no button down, the sideways movement over the canvas changes Size (the panel shows it through onBrushChange, the ghost follows).
  const resizeWithAlt = (event: PointerEvent): void => {
    const dx = resize.move(event, stroking);
    if (dx === null) return;
    const current = session.brush();
    const next = resizeByPointer(current, dx);
    if (next === current) return;
    session.setBrush(next);
    options.onBrushChange(session.brush());
  };

  const onPointerMove = (event: PointerEvent): void => {
    modifiers.remember(event);
    if (event.target !== element && !stroking) {
      lastPoint = null;
      lastClient = null;
      resize.reset();
      ghost?.hide();
      return;
    }
    resizeWithAlt(event);
    lastClient = { clientX: event.clientX, clientY: event.clientY };
    const point = surface.pointAt(event);
    lastPoint = point;
    if (stroking && point !== null) {
      session.pointerMove(point);
      workspace.kick();
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
    if (!event.altKey) return; // the turntable dollies
    event.preventDefault();
    const notches = wheel.add(event.deltaY, event.deltaMode);
    if (notches === 0) return;
    const current = session.brush();
    const shown = session.peekNext();
    const from = current.rotation.random && shown !== null ? (shown.angle * 180) / Math.PI : current.rotation.value; // R12: continues from the ghost's angle
    const next: BrushParams = updateBrushValue(current, 'rotation', { random: false, value: stepRotation(from, notches, event.shiftKey) }); // the wheel turns the dice off
    session.setBrush(next);
    options.onBrushChange(session.brush());
    updateGhost();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    modifiers.remember(event);
    if (event.key === 'Escape') {
      if (stroking) endStroke();
      else if (session.hasLineMarker()) {
        session.clearLineMarker();
        markerPoint = null;
        updateMarker();
      }
    }
    updateGhost();
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    modifiers.remember(event);
    updateGhost();
  };
  const onBlur = (): void => {
    modifiers.clear(); // R38
    endStroke();
    updateGhost();
  };
  const onLeave = (): void => {
    if (stroking) return;
    lastPoint = null;
    lastClient = null;
    ghost?.hide();
  };

  return {
    attach() {
      ghost = createGhostOverlay(scene.overlayRoot(), session.atlasTexture(), options.atlasGrid, host.invalidate);
      ghost.setTiling(scene.paintSurface().tilingX, scene.paintSurface().tilingY);
      element.addEventListener('pointerdown', onPointerDown);
      element.addEventListener('pointerleave', onLeave);
      element.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
    },
    detach() {
      endStroke();
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointerleave', onLeave);
      element.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      session.clearLineMarker();
      markerPoint = null;
      orbiting = false;
      lastPoint = null;
      lastClient = null;
      resize.reset();
      ghost?.dispose();
      ghost = null;
    },
    isBusy: () => stroking,
    surfaceChanged() {
      followSurface({
        surface: () => scene.paintSurface(),
        setGhostTiling: (x, y) => ghost?.setTiling(x, y),
        placeMarker: updateMarker,
        repickGhost: () => {
          if (!orbiting && lastClient !== null) lastPoint = surface.pointAt(lastClient);
        },
        showGhost: updateGhost,
      });
    },
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
  };
}
