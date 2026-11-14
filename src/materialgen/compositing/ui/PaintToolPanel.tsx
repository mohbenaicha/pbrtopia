import { Button, Icon, IconButton } from '@shared/ui-kit';
import type { BrushParams } from '../plan/brushParams';
import type { Palette, ShapeSlotNumber } from '../session/palette';
import { BrushControls } from './BrushControls';
import { PaintTip } from './PaintTip';
import { PaletteSwatches } from './PaletteSwatches';
import './paintPanel.css';

/** The words of the panel's messages (compositing R3, R21, R23, R37, R39, R40). */
export const PAINT_TEXT = {
  tooLargeToUndo: 'This stroke is too large to undo.',
  tooManyStamps: 'Too many stamps in one stroke',
} as const;

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
}

/** Compositing R5, R9, R21: the painter's panel in the Maps section: the four swatches, the brush controls, Undo and Redo, Done and Cancel, and the messages. */
export function PaintToolPanel(props: PaintToolPanelProps): React.JSX.Element {
  const { palette, brush, busy } = props;
  const message = props.notice === 'too-large-to-undo' ? PAINT_TEXT.tooLargeToUndo : props.notice === 'too-many-stamps' ? PAINT_TEXT.tooManyStamps : null;
  return (
    <div className="paint-panel" data-testid="paint-panel" aria-busy={busy}>
      <PaletteSwatches palette={palette} onPickShape={props.onPickShape} onToggleShapeActive={props.onToggleShapeActive} onRemoveShape={props.onRemoveShape} onToggleInvert={props.onToggleInvert} onPickMaterial={props.onPickMaterial} onRemoveMaterial={props.onRemoveMaterial} />
      <div className="paint-panel__history">
        <PaintTip tip="undo" layout="inline"><IconButton untitled label="Undo" icon={<Icon name="undo" size={16} />} disabled={!props.canUndo || busy} onClick={props.onUndo} /></PaintTip>
        <PaintTip tip="redo" layout="inline"><IconButton untitled label="Redo" icon={<Icon name="redo" size={16} />} disabled={!props.canRedo || busy} onClick={props.onRedo} /></PaintTip>
      </div>
      <BrushControls brush={brush} onChange={props.onBrushChange} />
      {message !== null && <p className="paint-panel__notice" role="status">{message}</p>}
      {props.error !== null && <p className="paint-panel__error" role="alert">{props.error}</p>}
      <div className="paint-panel__actions">
        <PaintTip tip="cancel" layout="inline"><Button variant="ghost" disabled={busy} onClick={props.onCancel}>Cancel</Button></PaintTip>
        <PaintTip tip="done" layout="inline"><Button variant="primary" loading={busy} disabled={busy} onClick={props.onDone}>Done</Button></PaintTip>
      </div>
    </div>
  );
}
