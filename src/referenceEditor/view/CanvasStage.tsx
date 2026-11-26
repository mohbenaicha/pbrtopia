import { useEffect, useRef } from 'react';
import type { DocumentChange, EditDocument } from '../document/EditDocument';
import type { DocumentEventName } from '../machine/interaction';
import type { Point, Rect } from '../model/geometry';
import { DirtyTiles } from '../render/dirtyTiles';
import { createFrameScheduler, imageDataOf, paintPicture } from '../render/paintPicture';
import { paintRubberBand, paintSelectionOverlay } from '../render/selectionOverlay';
import { encodeCanvasPng } from '../io/encodePng';
import { resizeBrushBy, type EditorSettings } from '../stroke/settings';
import { StrokeController, type StrokeEffects } from '../stroke/StrokeController';
import { keyActionOf } from './keymap';
import { cssTransformOf, fitTransform, panBy, PIXELATED_ABOVE, toImagePoint, wheelFactor, zoomAround, type ViewTransform } from './viewMath';

/** What the toolbar and the dialog can ask of the stage. Document commands are gated by the interaction machine (only when idle). */
export interface StageHandle {
  /** True when the machine lets this document or settings event through right now (not while dragging or panning). */
  accepts(name: DocumentEventName): boolean;
  run(command: 'undo' | 'redo' | 'invert' | 'fill' | 'crop'): void;
  fit(): void;
  zoom(factor: number): void;
  /** Paints anything still pending, then encodes the picture canvas as PNG. */
  flushAndEncode(): Promise<Blob>;
}

interface CanvasStageProps {
  doc: EditDocument;
  settings: EditorSettings;
  /** The document or its selection changed (the toolbar refreshes its enabled states). */
  onChanged: () => void;
  onBrushStep: (direction: 1 | -1) => void;
  /** Shift-move: the new brush size (whole pixels, already inside 1..256). */
  onBrushSize: (size: number) => void;
  handleRef: { current: StageHandle | null };
}

const PAN_FRACTION = 0.1;
const isControl = (target: EventTarget | null): boolean => target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
const isButton = (target: EventTarget | null): boolean => target instanceof HTMLElement && target.tagName === 'BUTTON';

/**
 * The picture, the selection tint and the pointer wiring. Everything per frame is imperative (canvases, refs, one rAF); React only
 * mounts the two canvases (architecture D6-D9). Zoom and pan are a CSS transform, so they never touch a pixel.
 */
export function CanvasStage({ doc, settings, onChanged, onBrushStep, onBrushSize, handleRef }: CanvasStageProps): React.JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  const pictureRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ settings, onChanged, onBrushStep, onBrushSize });
  latest.current = { settings, onChanged, onBrushStep, onBrushSize };
  const ghostRef = useRef<HTMLDivElement>(null);
  const ghostUpdater = useRef<() => void>(() => undefined);
  useEffect(() => ghostUpdater.current(), [settings.tool, settings.brushSize]); // the outline follows the tool and the size at once

  useEffect(() => {
    const stage = stageRef.current;
    const picture = pictureRef.current;
    const overlay = overlayRef.current;
    const ghost = ghostRef.current;
    const pictureContext = picture?.getContext('2d') ?? null;
    const overlayContext = overlay?.getContext('2d') ?? null;
    if (stage === null || picture === null || overlay === null || pictureContext === null || overlayContext === null) return undefined;

    let image = imageDataOf(doc.raster);
    const dirty = new DirtyTiles(doc.raster.width, doc.raster.height);
    let view: ViewTransform = { scale: 1, x: 0, y: 0 };
    let band: Rect | null = null;
    let stageRect = stage.getBoundingClientRect();
    let userMovedView = false;
    let sizeWhileResizing = latest.current.settings.brushSize; // the real-valued size of a Shift-move, so small movements are not lost to rounding
    const controller = new StrokeController(doc, (p) => toImagePoint(view, p));

    /** The brush ghost: an outline of the exact brush footprint (diameter = size, centred on the pixel under the pointer), hidden while panning or with the rectangle tool. */
    let pointer: Point | null = null;
    const updateGhost = (): void => {
      if (ghost === null) return;
      const { tool, brushSize } = latest.current.settings;
      const interaction = controller.interaction;
      if (pointer === null || tool === 'selectRect' || interaction.s === 'panning' || (interaction.s === 'idle' && interaction.spaceHeld)) { ghost.hidden = true; return; }
      const image = toImagePoint(view, pointer);
      const diameter = brushSize * view.scale;
      const x = view.x + (Math.floor(image.x) + 0.5) * view.scale - diameter / 2;
      const y = view.y + (Math.floor(image.y) + 0.5) * view.scale - diameter / 2;
      ghost.hidden = false;
      ghost.style.width = ghost.style.height = `${diameter}px`;
      ghost.style.transform = `translate(${x}px, ${y}px)`;
    };
    ghostUpdater.current = updateGhost;

    const applyView = (): void => {
      updateGhost();
      const transform = cssTransformOf(view);
      const rendering = view.scale > PIXELATED_ABOVE ? 'pixelated' : 'auto';
      for (const canvas of [picture, overlay]) { canvas.style.transform = transform; canvas.style.imageRendering = rendering; }
    };
    const fit = (): void => {
      stageRect = stage.getBoundingClientRect();
      view = fitTransform({ w: stageRect.width, h: stageRect.height }, { w: doc.raster.width, h: doc.raster.height });
      applyView();
    };
    const resizeCanvases = (): void => {
      picture.width = overlay.width = doc.raster.width;
      picture.height = overlay.height = doc.raster.height;
      image = imageDataOf(doc.raster);
      dirty.resize(doc.raster.width, doc.raster.height);
    };
    const repaint = (): void => {
      const rects = dirty.drain();
      if (rects.length > 0) {
        paintPicture(pictureContext, image, rects);
        paintSelectionOverlay(overlayContext, doc.mask, rects);
      }
      if (band !== null) paintRubberBand(overlayContext, band, 1 / view.scale);
    };
    const scheduler = createFrameScheduler(repaint);

    const afterChange = (change: DocumentChange | null): void => {
      if (change === null) return;
      if (change.relayout) { resizeCanvases(); fit(); }
      else if (change.dirty === 'all') dirty.markAll();
      else for (const rect of change.dirty) dirty.mark(rect);
      scheduler.request();
      latest.current.onChanged();
    };
    const afterEvent = (effects: StrokeEffects): void => {
      for (const rect of effects.dirty) dirty.mark(rect);
      if (effects.dirtyAll) dirty.markAll();
      if (effects.pan !== null) { view = panBy(view, effects.pan.x, effects.pan.y); userMovedView = true; applyView(); }
      if (effects.resize !== null) { sizeWhileResizing = resizeBrushBy(sizeWhileResizing, effects.resize); latest.current.onBrushSize(Math.round(sizeWhileResizing)); }
      band = controller.isIdle ? null : (effects.overlay?.rect ?? band);
      updateGhost();
      scheduler.request();
    };
    const send = (event: Parameters<StrokeController['handle']>[0]): StrokeEffects => {
      const effects = controller.handle(event, latest.current.settings);
      afterEvent(effects);
      return effects;
    };
    const point = (event: { clientX: number; clientY: number }): Point => ({ x: event.clientX - stageRect.left, y: event.clientY - stageRect.top });
    const zoom = (factor: number, at: Point): void => { view = zoomAround(view, at, factor); userMovedView = true; applyView(); };

    const onDown = (event: PointerEvent): void => {
      if (event.button === 1) event.preventDefault();
      stageRect = stage.getBoundingClientRect();
      stage.setPointerCapture(event.pointerId);
      pointer = point(event);
      send({ t: 'down', button: event.button, pointerId: event.pointerId, p: point(event) });
    };
    const onMove = (event: PointerEvent): void => {
      const resizing = event.shiftKey && latest.current.settings.tool !== 'selectRect' && controller.isIdle;
      if (!resizing) { pointer = point(event); sizeWhileResizing = latest.current.settings.brushSize; } // Shift-move: the ring stays where it was and only changes size
      const samples = event.getCoalescedEvents?.() ?? [];
      for (const sample of samples.length > 0 ? samples : [event]) send({ t: 'move', pointerId: event.pointerId, p: point(sample), shift: event.shiftKey });
    };
    const onUp = (event: PointerEvent): void => {
      send({ t: 'up', pointerId: event.pointerId });
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      latest.current.onChanged();
    };
    const onLeave = (): void => { pointer = null; send({ t: 'leave' }); };
    const onCancel = (event: PointerEvent): void => { send({ t: 'pointercancel', pointerId: event.pointerId }); latest.current.onChanged(); };
    const onWheel = (event: WheelEvent): void => { event.preventDefault(); zoom(wheelFactor(event.deltaY), point(event)); };
    const onContextMenu = (event: Event): void => event.preventDefault();
    const onBlur = (): void => { send({ t: 'blur' }); latest.current.onChanged(); };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Space') {
        if (isControl(event.target) || isButton(event.target)) return;
        event.preventDefault();
        if (!event.repeat) send({ t: 'spaceDown' });
        return;
      }
      if (isControl(event.target)) return;
      const action = keyActionOf(event);
      if (action === null) return;
      event.preventDefault();
      switch (action) {
        case 'undo': case 'redo': run(action); return;
        case 'brushSmaller': if (controller.handle({ t: 'setBrushSize' }, latest.current.settings).passThrough) latest.current.onBrushStep(-1); return;
        case 'brushLarger': if (controller.handle({ t: 'setBrushSize' }, latest.current.settings).passThrough) latest.current.onBrushStep(1); return;
        case 'escape': send({ t: 'escape' }); latest.current.onChanged(); return;
        case 'panLeft': keyPan(1, 0); return;
        case 'panRight': keyPan(-1, 0); return;
        case 'panUp': keyPan(0, 1); return;
        case 'panDown': keyPan(0, -1); return;
      }
    };
    const onKeyUp = (event: KeyboardEvent): void => { if (event.code === 'Space') send({ t: 'spaceUp' }); };

    /** R5: an arrow key pans by a tenth of the stage. */
    function keyPan(dx: number, dy: number): void {
      afterEvent({ ...IDLE_EFFECTS, pan: { x: dx * stageRect.width * PAN_FRACTION, y: dy * stageRect.height * PAN_FRACTION } });
    }

    function run(command:'undo' | 'redo' | 'invert' | 'fill' | 'crop'): void {
      if (!controller.handle({ t: command }, latest.current.settings).passThrough) return;
      afterChange(doc.perform(command, latest.current.settings.colour));
    }

    resizeCanvases();
    fit();
    repaint();
    const observer = new ResizeObserver(() => { if (userMovedView) stageRect = stage.getBoundingClientRect(); else fit(); });
    observer.observe(stage);
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onCancel);
    stage.addEventListener('pointerleave', onLeave);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    const handle: StageHandle = {
      accepts: (name) => controller.handle({ t: name }, latest.current.settings).passThrough,
      run,
      fit: () => { userMovedView = false; fit(); },
      zoom: (factor) => zoom(factor, { x: stageRect.width / 2, y: stageRect.height / 2 }),
      flushAndEncode: () => { repaint(); return encodeCanvasPng(picture); },
    };
    handleRef.current = handle;

    return () => {
      scheduler.cancel();
      observer.disconnect();
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onCancel);
      stage.removeEventListener('pointerleave', onLeave);
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      if (handleRef.current === handle) handleRef.current = null;
    };
  }, [doc, handleRef]);

  return (
    <div ref={stageRef} className="reference-editor__stage" aria-label="Image canvas">
      <canvas ref={pictureRef} className="reference-editor__canvas" />
      <canvas ref={overlayRef} className="reference-editor__canvas reference-editor__canvas--overlay" />
      <div ref={ghostRef} className="reference-editor__ghost" aria-hidden="true" hidden />
    </div>
  );
}

const IDLE_EFFECTS: StrokeEffects = { dirty: [], dirtyAll: false, pan: null, resize: null, passThrough: false, overlay: null };
