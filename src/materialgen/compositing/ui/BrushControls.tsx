import { memo, useCallback, useRef } from 'react';
import { Icon, IconButton, RangeSlider, Slider, Toggle } from '@shared/ui-kit';
import { BRUSH_CONTROLS, DEFAULT_BRUSH, updateBrushValue, type BrushControlKey, type BrushParams, type BrushValue } from '../plan/brushParams';
import { PaintTip } from './PaintTip';
import type { PaintTooltipKey } from './paintTooltips';

interface BrushControlsProps {
  brush: BrushParams;
  onChange: (brush: BrushParams) => void;
}

const twoDecimals = (value: number): string => value.toFixed(2);
const degrees = (value: number): string => `${Math.round(value)}°`;
const signed = (value: number): string => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;

interface ControlRowSpec {
  key: BrushControlKey;
  label: string;
  tip: PaintTooltipKey;
  format: (value: number) => string;
}

/** The five randomisable controls, in the order they are drawn: the one place their labels, words and number formats are named (compositing R9, R50). */
const CONTROL_ROWS: readonly ControlRowSpec[] = [
  { key: 'size', label: 'Size', tip: 'size', format: twoDecimals },
  { key: 'strength', label: 'Strength', tip: 'strength', format: twoDecimals },
  { key: 'hardness', label: 'Hardness', tip: 'hardness', format: twoDecimals },
  { key: 'distance', label: 'Distance', tip: 'distance', format: twoDecimals },
  { key: 'rotation', label: 'Rotation', tip: 'rotation', format: degrees },
];

type PatchValue = (key: BrushControlKey, patch: Partial<BrushValue>) => void;

interface ControlRowProps {
  spec: ControlRowSpec;
  control: BrushValue;
  onPatch: PatchValue;
}

/**
 * Compositing R50: label, slider, readout, dice and reset arrow of one control. With the dice off it is the single-value slider; on, the range slider in its place
 * (R44), the single value kept for when the dice goes off again. Memoised: a row redraws only when its own control changes (the optimisation of A15).
 */
const ControlRow = memo(function ControlRow({ spec, control, onPatch }: ControlRowProps): React.JSX.Element {
  const { key, label, tip, format } = spec;
  const limits = BRUSH_CONTROLS[key];
  const toggleDice = useCallback(() => onPatch(key, { random: !control.random }), [onPatch, key, control.random]);
  const changeValue = useCallback((value: number) => onPatch(key, { value }), [onPatch, key]);
  const changeRange = useCallback((low: number, high: number) => onPatch(key, { low, high }), [onPatch, key]);
  const dice = (
    <PaintTip tip="dice" layout="inline">
      <IconButton compact untitled label={`Random ${label}`} pressed={control.random} icon={<Icon name="dice" size={14} />} onClick={toggleDice} />
    </PaintTip>
  );
  return (
    <PaintTip tip={tip}>
      {control.random ? (
        <RangeSlider label={label} layout="row" marks low={control.low} high={control.high} min={limits.min} max={limits.max} step={limits.step} format={format} extra={dice} onChange={changeRange} />
      ) : (
        <Slider label={label} layout="row" value={control.value} min={limits.min} max={limits.max} step={limits.step} format={format} resetTo={limits.initial} extra={dice} onChange={changeValue} />
      )}
    </PaintTip>
  );
});

/**
 * Compositing R9, R44, R45, R49, R50: every brush control with its range and its tooltip; each slider has the reset arrow (preview R61), the muted marks (R46, range sliders only) and,
 * for the five randomisable ones, the dice. A control that only matters while another is on is not drawn while that one is off (R44): Height level and Additive
 * follow Height, Raise | Dent follows Edge burn, a range follows its dice.
 */
export function BrushControls({ brush, onChange }: BrushControlsProps): React.JSX.Element {
  const latest = useRef(brush);
  latest.current = brush;
  const onPatch = useCallback<PatchValue>((key, patch) => {
    latest.current = updateBrushValue(latest.current, key, patch); // two edits before the next render both land
    onChange(latest.current);
  }, [onChange]);
  const set = (patch: Partial<BrushParams>): void => onChange({ ...brush, ...patch });
  return (
    <div className="brush-controls">
      {CONTROL_ROWS.map((spec) => (
        <ControlRow key={spec.key} spec={spec} control={brush[spec.key]} onPatch={onPatch} />
      ))}
      <PaintTip tip="height"><Toggle dense label="Height" checked={brush.height.on} onChange={(on) => set({ height: { ...brush.height, on } })} /></PaintTip>
      {brush.height.on && (
        <div className="brush-controls__nested">
          <PaintTip tip="heightLevel"><Slider label="Height level" layout="row" value={brush.height.level} min={-1} max={1} step={0.01} format={signed} resetTo={DEFAULT_BRUSH.height.level} onChange={(level) => set({ height: { ...brush.height, level } })} /></PaintTip>
          <PaintTip tip="additive"><Toggle dense label="Additive" checked={brush.height.additive} onChange={(additive) => set({ height: { ...brush.height, additive } })} /></PaintTip>
        </div>
      )}
      <PaintTip tip="edgeBurn"><Toggle dense label="Edge burn" checked={brush.edgeBurn.on} onChange={(on) => set({ edgeBurn: { ...brush.edgeBurn, on } })} /></PaintTip>
      {brush.edgeBurn.on && (
        <div className="brush-controls__nested">
          <PaintTip tip="raiseDent"><Toggle dense label={brush.edgeBurn.direction === 'dent' ? 'Dent' : 'Raise'} checked={brush.edgeBurn.direction === 'dent'} onChange={(dent) => set({ edgeBurn: { ...brush.edgeBurn, direction: dent ? 'dent' : 'raise' } })} /></PaintTip>
        </div>
      )}
    </div>
  );
}
