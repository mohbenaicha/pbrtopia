import { Button, Slider, Toggle } from '@shared/ui-kit';
import type { CloneSettings } from '../clone/createCloneEngine';
import { BRUSH_CONTROLS } from '../plan/brushParams';
import { cloneButtonReason, confirmButtonReason } from './cloneReasons';
import type { CloneView } from './createCloneMode';
import { PaintTip } from './PaintTip';

export interface CloneControlsProps {
  view: CloneView;
  /** The brush Size, shared with Stamp (clone R22). */
  size: number;
  onSize: (size: number) => void;
  onSettings: (patch: Partial<CloneSettings>) => void;
  /** The Scale slider while a copy floats, in percent. */
  onScale: (percent: number) => void;
  onClone: () => void;
  onConfirm: () => void;
}

const twoDecimals = (value: number): string => value.toFixed(2);
const percent = (value: number): string => `${Math.round(value)}%`;
const SCALE = { min: 25, max: 1000, step: 1 } as const; // clone R7; R9a limits it further per copy

/** Clone R18: the ghost shape, Size (Scale while a copy floats), Hardness, Strength, then the Clone and Confirm buttons. */
export function CloneControls({ view, size, onSize, onSettings, onScale, onClone, onConfirm }: CloneControlsProps): React.JSX.Element {
  const limits = BRUSH_CONTROLS.size;
  const cloneReason = cloneButtonReason(view);
  const confirmReason = confirmButtonReason(view);
  return (
    <div className="brush-controls clone-controls" data-testid="clone-controls">
      <PaintTip tip="ghostShape">
        <Toggle dense label="Square" checked={view.settings.shape === 'square'} onChange={(square) => onSettings({ shape: square ? 'square' : 'round' })} />
      </PaintTip>
      {view.scalePercent === null ? (
        <PaintTip tip="cloneSize"><Slider label="Size" layout="row" value={size} min={limits.min} max={limits.max} step={limits.step} format={twoDecimals} resetTo={limits.initial} onChange={onSize} /></PaintTip>
      ) : (
        <PaintTip tip="scale"><Slider label="Scale" layout="row" value={view.scalePercent} min={SCALE.min} max={SCALE.max} step={SCALE.step} format={percent} resetTo={100} onChange={onScale} /></PaintTip>
      )}
      <PaintTip tip="cloneHardness"><Slider label="Hardness" layout="row" value={view.settings.hardness} min={0} max={1} step={0.01} format={twoDecimals} resetTo={0.7} onChange={(hardness) => onSettings({ hardness })} /></PaintTip>
      <PaintTip tip="cloneStrength"><Slider label="Strength" layout="row" value={view.settings.strength} min={0} max={1} step={0.01} format={twoDecimals} resetTo={1} onChange={(strength) => onSettings({ strength })} /></PaintTip>
      <div className="clone-controls__buttons">
        <PaintTip tip="clone" layout="inline"><Button variant="secondary" disabled={cloneReason !== undefined} {...(cloneReason ? { title: cloneReason } : {})} onClick={onClone}>Clone</Button></PaintTip>
        <PaintTip tip="confirm" layout="inline"><Button variant="primary" disabled={confirmReason !== undefined} {...(confirmReason ? { title: confirmReason } : {})} onClick={onConfirm}>Confirm</Button></PaintTip>
      </div>
    </div>
  );
}
