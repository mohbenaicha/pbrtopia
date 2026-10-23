import type { CSSProperties } from 'react';
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
}

export function Slider({ label, value, min, max, step = 1, onChange, format = String, disabled = false, layout = 'stacked' }: SliderProps): React.JSX.Element {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const labelText = <span className="ui-slider__label">{label}</span>;
  const valueText = <output className="ui-slider__value">{format(value)}</output>;
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
      <div className="ui-slider" data-layout="row" data-disabled={disabled ? '' : undefined}>
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
