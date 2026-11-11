import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, IconButton } from '@shared/ui-kit';
import { editKindOf, type CropRect, type MirrorPlan } from '@mat/imageops';
import { kindLabel, readMapPixels, type MapKind, type MapsController, type MapsState } from '@mat/maps';
import type { ToolTransform, ToolView } from '@mat/preview';
import type { ColorMode } from '@mat/storage';
import { applyGeometryOp, type GeometryOpResult, type GeometryPorts } from '../../imageops/applyGeometryOp';
import type { GeometryOps } from '../../imageops/useImageopsSessions';
import { GeometryToolPanel, type GeometryToolName } from './GeometryToolPanel';
import type { ToolOutcome } from './useToolApply';

/** The transform an open tool puts on the viewport's maps (preview R58); `hold` is set once Apply worked, to keep it until the committed maps are shown (imageops R59). */
export type HeldToolView = ToolView;

interface GeometryToolsInput {
  state: MapsState;
  colorMode: ColorMode;
  canWrite: boolean;
  readOnlyReason: string;
  opOpen: boolean; // another op is open or running (imageops R9)
  busy: boolean; // maps are being changed
  /** Runs work that changes the maps with no panel (Swap diagonals) while every other op button waits (imageops R9). */
  exclusive(work: () => Promise<void>): Promise<void>;
  geometry: GeometryOps;
  controller: MapsController;
  readBlob(key: string): Promise<Blob | null>;
  /** Tells the host a tool panel opened or closed, so the other op buttons can step aside and the Maps list can fold (imageops R9, R52). */
  onToolOpenChange(open: boolean): void;
  /** Gives the viewport the transform to put on the maps, or null to show the maps as they are (imageops R53, R59). */
  onToolViewChange(view: HeldToolView | null): void;
}

const TOOL_LABEL: Record<GeometryToolName, string> = { crop: 'Crop', mirror: 'Mirror' };

/** The working keys of every map and the side, joined: changes when anything under an open panel changes (imageops R61). */
const signatureOf = (state: MapsState): string =>
  `${state.size ?? ''}|${(Object.keys(state.maps) as MapKind[]).map((kind) => `${kind}:${state.maps[kind]?.workingKey ?? ''}`).join(',')}`;

/**
 * Imageops R20, R29-R36, R52-R62: Crop, Mirror and Swap diagonals, each changing every picture map at once and undone as one step.
 * The buttons go in the Maps heading bar; the open panel is drawn where the caller puts it, in place of the cards.
 */
export function useGeometryTools({ state, colorMode, canWrite, readOnlyReason, opOpen, busy, exclusive, geometry, controller, readBlob, onToolOpenChange, onToolViewChange }: GeometryToolsInput): { buttons: ReactNode; panel: ReactNode } {
  const [tool, setTool] = useState<GeometryToolName | null>(null);
  const opened = useRef<string | null>(null); // the signature of the maps when the panel opened
  const ownApply = useRef(false); // set while this panel's own Apply is changing the maps, which is not a reason to cancel
  const applied = useRef(false);
  const lastTransform = useRef<ToolTransform | null>(null);
  const size = state.size;
  const signature = signatureOf(state);
  const hasMaps = size !== null && (Object.keys(state.maps) as MapKind[]).some((kind) => editKindOf(kind) !== null); // the labels are not edited as a picture
  const reason = !canWrite ? readOnlyReason : !hasMaps ? 'There are no maps yet.' : opOpen || tool !== null ? 'Another edit is open. Apply or cancel it first.' : busy ? 'The maps are being changed.' : undefined;
  const baseKeys: Record<string, string> = {}; // the working key of every picture map the viewport shows (a diffuse map and the labels are not), for the release of a held view
  for (const kind of Object.keys(state.maps) as MapKind[]) {
    const key = state.maps[kind]?.workingKey;
    if (editKindOf(kind) === kind && key !== undefined) baseKeys[kind] = key;
  }

  const run = (label: string, transform: GeometryPorts['transform']): Promise<GeometryOpResult> =>
    applyGeometryOp({
      state,
      label,
      kindLabel: (kind) => kindLabel(kind, colorMode),
      ports: { readPixels: async (key) => readMapPixels(await readBlob(key)), transform, applyEdits: controller.applyEdits },
    });
  const open = (next: GeometryToolName | null): void => {
    setTool(next);
    opened.current = next === null ? null : signature;
    ownApply.current = false;
    applied.current = false;
    lastTransform.current = null;
    onToolOpenChange(next !== null);
  };
  const close = (): void => {
    if (!applied.current) onToolViewChange(null); // after a good Apply the transform is held until the committed maps are shown
    open(null);
  };
  const apply = async (label: string, transform: GeometryPorts['transform']): Promise<ToolOutcome> => {
    ownApply.current = true;
    try {
      const outcome = await run(label, transform);
      if (outcome.ok) {
        applied.current = true;
        if (lastTransform.current !== null) onToolViewChange({ transform: lastTransform.current, baseKeys, hold: true });
      } else ownApply.current = false;
      return outcome;
    } catch (error) {
      ownApply.current = false;
      throw error;
    }
  };

  // R61: a working copy that changes under the open panel (a finished generation, an undo, another tab) cancels it; the panel's own Apply does not.
  useEffect(() => {
    if (tool === null || opened.current === null || signature === opened.current || ownApply.current) return;
    controller.refuse(`The maps changed. ${TOOL_LABEL[tool]} was cancelled.`);
    onToolViewChange(null);
    setTool(null);
    opened.current = null;
    onToolOpenChange(false);
  }, [signature, tool, controller, onToolViewChange, onToolOpenChange]);

  const swap = (): Promise<void> =>
    exclusive(async () => {
      try {
        const result = await run('Swap diagonals', geometry.swap);
        if (!result.ok && result.message !== undefined) controller.refuse(result.message);
      } catch {
        controller.refuse('Could not apply. Nothing changed.'); // the file could not be read or saved
      }
    });
  const button = (label: string, icon: 'crop' | 'mirror' | 'swap', onClick: () => void): React.JSX.Element => (
    <IconButton label={label} icon={<Icon name={icon} size={16} />} disabled={reason !== undefined} {...(reason ? { disabledReason: reason } : {})} onClick={onClick} />
  );
  const onTransform = (transform: ToolTransform): void => {
    lastTransform.current = transform;
    onToolViewChange({ transform, baseKeys, hold: false });
  };

  return {
    buttons: (
      <>
        {button('Crop', 'crop', () => open('crop'))}
        {button('Mirror', 'mirror', () => open('mirror'))}
        {button('Swap diagonals', 'swap', () => void swap())}
      </>
    ),
    panel:
      tool !== null && size !== null ? (
        <GeometryToolPanel
          tool={tool}
          size={size}
          onTransform={onTransform}
          onApplyCrop={(rect: CropRect) => apply('Crop', (image, kind) => geometry.crop(image, kind, rect, size))}
          onApplyMirror={(plan: MirrorPlan) => apply('Mirror', (image, kind) => geometry.mirror(image, kind, plan))}
          onClose={close}
        />
      ) : null,
  };
}
