import type { PaintHost } from '@mat/preview';
import type { BrushAtlas } from '../atlas/readBrushAtlas';
import type { PaintMaterial } from '../gpu/paintMaterial';
import type { PainterMaps } from '../gpu/createStampPainter';
import type { BrushParams } from '../plan/brushParams';
import type { ShapeSlot } from '../plan/planStamps';
import { createPaintSession, type PaintedBytes } from '../session/createPaintSession';
import { createCloneMode, type CloneMode } from './createCloneMode';
import { createPaintWorkspace, type PaintState } from './createPaintWorkspace';
import { createStampMode } from './createStampMode';
import type { PaintTool } from './paintTool';

export type { PaintState } from './createPaintWorkspace';
export type { CloneView } from './createCloneMode';
export type { PaintTool } from './paintTool';

/** What the panel does with the Clone tool (clone R7, R8, R12, R18). */
export type CloneControl = Pick<CloneMode, 'view' | 'subscribe' | 'lift' | 'confirm' | 'setSettings' | 'setScalePercent'>;

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

export interface PaintController {
  setBrush(brush: BrushParams): void;
  setShapes(shapes: readonly ShapeSlot[]): void;
  setMaterial(material: PaintMaterial): void;
  /** Clone R1: switches between Stamp and Clone; ignored while a copy floats. Switching to Stamp drops the highlight. */
  setTool(tool: PaintTool): void;
  readonly clone: CloneControl;
  undo(): void;
  redo(): void;
  /** Done: draws what is queued and reads the painted maps (R22). */
  readPainted(): PaintedBytes;
  state(): PaintState;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

/**
 * Compositing A5: one painting session on the preview's Plane. Creates the session, the shared workspace (textures, frame loop, undo, surface pointer) and the
 * Stamp tool mode, and hands the pointer to the mode. `dispose` puts the preview back as it was.
 */
export function createPaintController(options: PaintControllerOptions): PaintController {
  const { host, atlas, side } = options;
  const session = createPaintSession(host.renderer, {
    side, atlas: { data: atlas.data, width: atlas.width, height: atlas.height }, grid: atlas.grid, maps: options.maps, normalDirection: host.normalDirection(),
    material: options.material, shapes: options.shapes,
  });
  session.setBrush(options.brush);
  const workspace = createPaintWorkspace({ host, session, onInterrupted: options.onInterrupted });
  const stamp = createStampMode({ workspace, atlasGrid: atlas.grid, material: options.material, shapes: options.shapes, onBrushChange: options.onBrushChange });
  const clone = createCloneMode({ workspace, onBrushChange: options.onBrushChange });
  let tool: PaintTool = 'stamp';
  workspace.setMode(stamp);
  return {
    setBrush(brush) {
      stamp.setBrush(brush);
      clone.brushChanged(); // the Size may be shared with a highlight that just became (un)liftable (clone R6)
    },
    setShapes: stamp.setShapes,
    setMaterial: stamp.setMaterial,
    setTool(next) {
      if (next === tool || clone.view().phase === 'floating') return;
      tool = next;
      workspace.setMode(next === 'clone' ? clone : stamp);
    },
    clone: { view: clone.view, subscribe: clone.subscribe, lift: clone.lift, confirm: clone.confirm, setSettings: clone.setSettings, setScalePercent: clone.setScalePercent },
    undo: workspace.undo,
    redo: workspace.redo,
    readPainted: workspace.readPainted,
    state: workspace.state,
    subscribe: workspace.subscribe,
    dispose: workspace.dispose,
  };
}
