import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import './Slider.css';

interface SliderProps {
  label: string; // shown above the track and used as the accessible name
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string; // the number readout, e.g. a percentage
  disabled?: boolean;
  layout?: 'stacked' | 'row'; // stacked: label and value above the track; row: label, track and value on one line
  readout?: ReactNode; // replaces the number readout, e.g. with a number field and a reset button
  resetTo?: number; // the default: a reset arrow after the number sets it, and is disabled at it or while the slider is disabled
  onReset?: () => void; // what the reset arrow does in place of onChange(resetTo), for a slider that saves only on release
}

export function Slider({ label, value, min, max, step = 1, onChange, format = String, disabled = false, layout = 'stacked', readout, resetTo, onReset }: SliderProps): React.JSX.Element {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const labelText = <span className="ui-slider__label">{label}</span>;
  const number = readout ?? <output className="ui-slider__value">{format(value)}</output>;
  const valueText =
    resetTo === undefined ? (
      number
    ) : (
      <span className="ui-slider__readout">
        {number}
        <IconButton label={`Reset ${label}`} icon={<Icon name="reset" />} compact disabled={disabled || value === resetTo} onClick={onReset ?? (() => onChange(resetTo))} />
      </span>
    );
  const track = (
    <input
      type="range"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      style={{ '--slider-fill': `${fill}%` } as CSSProperties}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
  if (layout === 'row') {
    return (
      <div className="ui-slider" data-layout="row" data-resettable={resetTo === undefined ? undefined : ''} data-disabled={disabled ? '' : undefined}>
        {labelText}
        {track}
        {valueText}
      </div>
    );
  }
  return (
    <div className="ui-slider" data-disabled={disabled ? '' : undefined}>
      <div className="ui-slider__header">
        {labelText}
        {valueText}
      </div>
      {track}
    </div>
  );
}
