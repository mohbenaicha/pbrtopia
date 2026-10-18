import type { CSSProperties } from 'react';
import './Slider.css';

export interface SliderProps {
  label: string; // shown above the track and used as the accessible name
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string; // the number readout, e.g. a percentage
  disabled?: boolean;
}

export function Slider({ label, value, min, max, step = 1, onChange, format = String, disabled = false }: SliderProps): React.JSX.Element {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="ui-slider" data-disabled={disabled ? '' : undefined}>
      <div className="ui-slider__header">
        <span className="ui-slider__label">{label}</span>
        <output className="ui-slider__value">{format(value)}</output>
      </div>
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
    </div>
  );
}
