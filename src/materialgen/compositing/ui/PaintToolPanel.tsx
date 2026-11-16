import { Button, Icon, IconButton } from '@shared/ui-kit';
import type { CloneSettings } from '../clone/createCloneEngine';
import type { BrushParams } from '../plan/brushParams';
import type { Palette, ShapeSlotNumber } from '../session/palette';
import { BrushControls } from './BrushControls';
import { CloneControls } from './CloneControls';
import { CLONE_REASONS } from './cloneReasons';
import type { CloneView } from './createCloneMode';
import { ModeSwitch } from './ModeSwitch';
import type { PaintTool } from './paintTool';
import { PaintTip } from './PaintTip';
import { PaletteSwatches } from './PaletteSwatches';
import './paintPanel.css';

/** The words of the panel's messages (compositing R3, R21, R23, R37, R39, R40). */
export const PAINT_TEXT = {
  tooLargeToUndo: 'This stroke is too large to undo.',
  occlusion: 'Does not apply to the occlusion map (regenerate it from height).',
  tooManyStamps: 'Too many stamps in one stroke',
} as const;

/** Clone R1, R18: what the panel needs to offer the Clone tool; without it the panel is the Stamp panel alone. */
export interface CloneSection {
  tool: PaintTool;
  view: CloneView;
  onToolChange: (tool: PaintTool) => void;
  onSettings: (patch: Partial<CloneSettings>) => void;
  onScale: (percent: number) => void;
  onClone: () => void;
  onConfirm: () => void;
}

interface PaintToolPanelProps {
  palette: Palette;
  brush: BrushParams;
  onBrushChange: (brush: BrushParams) => void;
  onPickShape: (slot: ShapeSlotNumber) => void;
  onToggleShapeActive: (slot: ShapeSlotNumber) => void;
  onRemoveShape: (slot: ShapeSlotNumber) => void;
  onToggleInvert: (slot: ShapeSlotNumber) => void;
  onPickMaterial: () => void;
  onRemoveMaterial: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  notice: 'too-many-stamps' | 'too-large-to-undo' | null;
  error: string | null;
  busy: boolean;
  onDone: () => void;
  onCancel: () => void;
  clone?: CloneSection;
}

/**
 * Compositing R5, R9, R21: the painter's panel in the Maps section. Stamp: the four swatches, Undo and Redo, the brush controls. Clone (clone R18): the mode switch,
 * Undo and Redo, then the Clone controls. Both end with the messages, Done and Cancel; while a copy floats Undo, Redo and Done are disabled with the reason (clone R16, R17).
 */
export function PaintToolPanel(props: PaintToolPanelProps): React.JSX.Element {
  const { palette, brush, busy, clone } = props;
  const floating = clone?.view.phase === 'floating';
  const message = props.notice === 'too-large-to-undo' ? PAINT_TEXT.tooLargeToUndo : props.notice === 'too-many-stamps' ? PAINT_TEXT.tooManyStamps : null;
  const history = (
    <div className="paint-panel__history">
      <PaintTip tip="undo" layout="inline"><IconButton untitled label="Undo" icon={<Icon name="undo" size={16} />} disabled={!props.canUndo || busy || floating} {...(floating ? { disabledReason: CLONE_REASONS.floating } : {})} onClick={props.onUndo} /></PaintTip>
      <PaintTip tip="redo" layout="inline"><IconButton untitled label="Redo" icon={<Icon name="redo" size={16} />} disabled={!props.canRedo || busy || floating} {...(floating ? { disabledReason: CLONE_REASONS.floating } : {})} onClick={props.onRedo} /></PaintTip>
    </div>
  );
  const cloning = clone?.tool === 'clone';
  return (
    <div className="paint-panel" data-testid="paint-panel" aria-busy={busy}>
      {clone !== undefined && <ModeSwitch tool={clone.tool} onChange={clone.onToolChange} locked={floating === true} />}
      {cloning ? (
        <>
          {history}
          <CloneControls view={clone.view} size={brush.size.value} onSize={(value) => props.onBrushChange({ ...brush, size: { ...brush.size, value } })} onSettings={clone.onSettings} onScale={clone.onScale} onClone={clone.onClone} onConfirm={clone.onConfirm} />
        </>
      ) : (
        <>
          <PaletteSwatches palette={palette} onPickShape={props.onPickShape} onToggleShapeActive={props.onToggleShapeActive} onRemoveShape={props.onRemoveShape} onToggleInvert={props.onToggleInvert} onPickMaterial={props.onPickMaterial} onRemoveMaterial={props.onRemoveMaterial} />
          {history}
          <BrushControls brush={brush} onChange={props.onBrushChange} />
        </>
      )}
      <p className="paint-panel__warning" data-testid="paint-occlusion-warning">{PAINT_TEXT.occlusion}</p>
      {message !== null && <p className="paint-panel__notice" role="status">{message}</p>}
      {props.error !== null && <p className="paint-panel__error" role="alert">{props.error}</p>}
      <div className="paint-panel__actions">
        <PaintTip tip="cancel" layout="inline"><Button variant="ghost" disabled={busy} onClick={props.onCancel}>Cancel</Button></PaintTip>
        <PaintTip tip="done" layout="inline"><Button variant="primary" loading={busy} disabled={busy || floating} {...(floating ? { title: CLONE_REASONS.floating } : {})} onClick={props.onDone}>Done</Button></PaintTip>
      </div>
    </div>
  );
}
