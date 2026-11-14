import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog, Icon, IconButton } from '@shared/ui-kit';
import {
  DEFAULT_BRUSH, EMPTY_PALETTE, canPaint, createPaintController, loadBrushAtlas, loadPaintMaps, MaterialPicker, paintEntryReason, paintedPicturesOf, paintMaterialOf, PaintToolPanel,
  planCommitPaint, removeMaterial, removeShape, setMaterial, setShape, ShapePicker, shapeSlotsOf, toggleInvert,
  type BrushAtlas, type BrushParams, type LoadedPaintMaps, type PaintController, type PaintState, type Palette, type ShapeSlotNumber,
} from '@mat/compositing';
import { readMapPixels, type MapKind, type MapsController, type MapsState } from '@mat/maps';
import { usePaintBridgeState } from '@mat/preview';
import { loadBaseMaterials } from '../masks/loadBaseMaterials';
import { mapsSignature } from './mapsSignature';
import { PaintBridgeContext } from './PaintBridgeContext';

interface PaintToolInput {
  state: MapsState;
  canWrite: boolean;
  readOnlyReason: string;
  opOpen: boolean; // another op is open or running (imageops R9, compositing R2)
  busy: boolean; // maps are being changed
  controller: MapsController;
  readBlob(key: string): Promise<Blob | null>;
  hasMasks: boolean; // the material has a decomposition (R41)
  /** Tells the host the painter opened or closed, so the other op buttons step aside and the Maps list folds (compositing R2). */
  onToolOpenChange(open: boolean): void;
}

interface OpenSession {
  controller: PaintController;
  loaded: LoadedPaintMaps;
  side: number;
  signature: string;
  unsubscribe: () => void;
}

type Phase = 'idle' | 'loading' | 'open' | 'saving';
type PickerTarget = { kind: 'shape'; slot: ShapeSlotNumber } | { kind: 'material' } | null;

const IDLE_STATE: PaintState = { canUndo: false, canRedo: false, hasStrokes: false, notice: null };
const NEUTRAL_MATERIAL = { albedo: [128, 128, 128] as const, roughness: 128, metalness: 0 };
const SAVE_FAILED = 'Could not save the painting. Nothing changed.'; // R23

const kindsOf = (pictures: ReturnType<typeof paintedPicturesOf>, colourKind: 'albedo' | 'diffuse'): MapKind[] => [
  ...(pictures.colour ? [colourKind] : []), ...(pictures.rough ? ['rough' as const] : []), ...(pictures.metal ? ['metal' as const] : []),
  ...(pictures.height ? ['height' as const] : []), ...(pictures.normal ? ['normal' as const] : []),
];

/**
 * Compositing R1-R5, R8, R21-R24, R36, R39-R41: the splat painter's entry button in the Maps heading bar, its panel in place of the cards, the pickers and the
 * discard question. The palette and brush are kept while the project is open (R8). The session itself lives in a `PaintController` on the preview's scene.
 */
export function usePaintTool(input: PaintToolInput): { button: ReactNode; panel: ReactNode; overlays: ReactNode; open: boolean } {
  const { state, canWrite, controller: maps } = input;
  const bridge = useContext(PaintBridgeContext);
  const { host, mesh } = usePaintBridgeState(bridge);
  const [atlas, setAtlas] = useState<BrushAtlas | null>(null);
  const [atlasFailed, setAtlasFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [palette, setPalette] = useState<Palette>(EMPTY_PALETTE);
  const [brush, setBrush] = useState<BrushParams>(DEFAULT_BRUSH);
  const [paintState, setPaintState] = useState<PaintState>(IDLE_STATE);
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<OpenSession | null>(null);
  const settleDiscard = useRef<((discard: boolean) => void) | null>(null);
  const latest = useRef(input);
  latest.current = input;
  const signature = mapsSignature(state);

  useEffect(() => {
    if (mesh !== 'plane' || atlas !== null) return undefined;
    let cancelled = false;
    loadBrushAtlas().then(
      (loaded) => !cancelled && setAtlas(loaded),
      () => !cancelled && setAtlasFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [mesh, atlas]);

  const closeSession = useCallback((): void => {
    const open = session.current;
    session.current = null;
    open?.unsubscribe();
    open?.controller.dispose();
    setPaintState(IDLE_STATE);
    setPicker(null);
    setError(null);
    setPhase('idle');
    latest.current.onToolOpenChange(false);
  }, []);

  const askDiscard = useCallback((): Promise<boolean> => {
    setDiscardOpen(true);
    return new Promise<boolean>((resolve) => {
      settleDiscard.current = (discard) => {
        settleDiscard.current = null;
        setDiscardOpen(false);
        resolve(discard);
      };
    });
  }, []);

  // R3: leaving with strokes asks; the mesh picker asks through the bridge.
  useEffect(() => {
    bridge.setMeshGuard(async () => {
      const open = session.current;
      if (open === null) return true;
      if (open.controller.state().hasStrokes && !(await askDiscard())) return false;
      closeSession();
      return true;
    });
    return () => bridge.setMeshGuard(null);
  }, [bridge, askDiscard, closeSession]);
  useEffect(() => {
    if (mesh !== 'plane' && session.current !== null) closeSession(); // the Plane is gone: nothing to paint on (R24)
  }, [mesh, closeSession]);
  useEffect(() => () => {
    const open = session.current;
    session.current = null;
    open?.unsubscribe();
    open?.controller.dispose(); // the project closed: the session copy is discarded (R24)
  }, []);

  useEffect(() => {
    const open = session.current;
    if (open === null) return;
    open.controller.setShapes(canPaint(palette) ? shapeSlotsOf(palette) : []); // no ghost and no stroke until R5 is met
    open.controller.setMaterial(paintMaterialOf(palette.material) ?? NEUTRAL_MATERIAL);
  }, [palette, phase]);
  useEffect(() => {
    session.current?.controller.setBrush(brush);
  }, [brush, phase]);

  const reason = paintEntryReason({ mesh, size: state.size, canWrite, readOnlyReason: input.readOnlyReason, otherEditOpen: input.opOpen, mapsBusy: input.busy, atlasFailed, previewReady: host !== null && atlas !== null });

  const open = async (): Promise<void> => {
    if (reason !== undefined || host === null || atlas === null || state.size === null || phase !== 'idle') return;
    const side = state.size;
    setPhase('loading');
    setError(null);
    input.onToolOpenChange(true);
    try {
      const loaded = await loadPaintMaps(state, async (key) => readMapPixels(await input.readBlob(key)));
      const controller = createPaintController({
        host, atlas, maps: loaded.maps, side, material: paintMaterialOf(palette.material) ?? NEUTRAL_MATERIAL, shapes: canPaint(palette) ? shapeSlotsOf(palette) : [], brush,
        onBrushChange: setBrush,
        onInterrupted: () => {
          closeSession();
          latest.current.controller.refuse('Painting was interrupted. Nothing was saved.'); // R30
        },
      });
      const unsubscribe = controller.subscribe(() => setPaintState(controller.state()));
      session.current = { controller, loaded, side, signature, unsubscribe };
      setPaintState(controller.state());
      setPhase('open');
    } catch {
      input.onToolOpenChange(false);
      setPhase('idle');
      maps.refuse('Could not open the painter. Nothing changed.');
    }
  };

  const done = async (): Promise<void> => {
    const open = session.current;
    if (open === null || phase !== 'open') return;
    if (!canWrite) return setError('The project is open elsewhere'); // R39
    if (signature !== open.signature) return setError('The maps changed while painting. Nothing was saved.'); // R40
    setPhase('saving');
    setError(null);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); // the busy state is drawn before the work (R31)
      const pictures = paintedPicturesOf(open.controller.readPainted(), open.side, { albedo: open.loaded.albedoChannels, normal: open.loaded.normalChannels });
      const targets = kindsOf(pictures, open.loaded.colourKind);
      if (targets.length === 0) return closeSession(); // nothing painted: nothing written (R22)
      const stored = await maps.commitPlanned(targets, (current, io) => planCommitPaint(current, pictures, open.loaded.colourKind, io));
      if (stored) closeSession();
      else {
        setPhase('open');
        setError(SAVE_FAILED);
      }
    } catch {
      setPhase('open');
      setError(SAVE_FAILED);
    }
  };

  const cancel = async (): Promise<void> => {
    const open = session.current;
    if (open === null) return;
    if (open.controller.state().hasStrokes && !(await askDiscard())) return;
    closeSession();
  };

  const taken = (slot: ShapeSlotNumber): number[] => palette.shapes.flatMap((shape, index) => (shape !== null && index !== slot ? [shape.index] : []));
  const busy = phase === 'saving';
  const entryHint = reason ?? (phase === 'idle' ? undefined : 'Painting is open');

  return {
    open: phase !== 'idle',
    button: <IconButton label="Paint" icon={<Icon name="brush" size={16} />} disabled={entryHint !== undefined} {...(entryHint ? { disabledReason: entryHint } : {})} loading={phase === 'loading'} onClick={() => void open()} testId="paint-open" />,
    panel:
      phase === 'open' || phase === 'saving' ? (
        <PaintToolPanel
          palette={palette}
          brush={brush}
          onBrushChange={setBrush}
          onPickShape={(slot) => setPicker({ kind: 'shape', slot })}
          onRemoveShape={(slot) => setPalette((current) => removeShape(current, slot))}
          onToggleInvert={(slot) => setPalette((current) => toggleInvert(current, slot))}
          onPickMaterial={() => setPicker({ kind: 'material' })}
          onRemoveMaterial={() => setPalette((current) => removeMaterial(current))}
          canUndo={paintState.canUndo}
          canRedo={paintState.canRedo}
          onUndo={() => session.current?.controller.undo()}
          onRedo={() => session.current?.controller.redo()}
          notice={paintState.notice}
          hasMasks={input.hasMasks}
          error={error}
          busy={busy}
          onDone={() => void done()}
          onCancel={() => void cancel()}
        />
      ) : null,
    overlays: (
      <>
        {picker?.kind === 'shape' && (
          <ShapePicker
            taken={taken(picker.slot)}
            onChoose={(index) => {
              setPalette((current) => setShape(current, picker.slot, index));
              setPicker(null);
            }}
            onClose={() => setPicker(null)}
          />
        )}
        {picker?.kind === 'material' && (
          <MaterialPicker
            loadTable={loadBaseMaterials}
            onChoose={(material) => {
              setPalette((current) => setMaterial(current, material));
              setPicker(null);
            }}
            onClose={() => setPicker(null)}
          />
        )}
        <ConfirmDialog open={discardOpen} title="Discard the painting?" confirmLabel="Discard" busy={false} onCancel={() => settleDiscard.current?.(false)} onConfirm={() => settleDiscard.current?.(true)}>
          <p>The strokes painted in this session are not saved.</p>
        </ConfirmDialog>
      </>
    ),
  };
}
