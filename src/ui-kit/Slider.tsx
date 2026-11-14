import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Tooltip, TOOLTIP_SKIP_ATTRIBUTE } from './Tooltip';
import './Slider.css';

const SKIP_TOOLTIP = { [TOOLTIP_SKIP_ATTRIBUTE]: '' };

interface SliderProps {
  label: string; // shown above the track and used as the accessible name
  hint?: string; // what the setting does: the sentence of the label's tooltip
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
  marks?: boolean; // a stronger track with muted ticks at the left end, the middle and the right end, so the middle can be read (compositing R46)
  extra?: ReactNode; // a control drawn between the number and the reset arrow, e.g. the dice of a random range (compositing R50)
}

/** The three muted ticks of a marked track (R46); shared with RangeSlider. */
export function SliderTicks(): React.JSX.Element {
  return (
    <span className="ui-slider__marks" aria-hidden="true">
      <span className="ui-slider__mark" style={{ left: '0%' }} />
      <span className="ui-slider__mark" style={{ left: '50%' }} />
      <span className="ui-slider__mark" style={{ left: '100%' }} />
    </span>
  );
}

interface SliderReadoutProps {
  number: ReactNode;
  extra?: ReactNode;
  resetLabel: string;
  resetDisabled: boolean;
  onReset: () => void;
}

/** The number, an optional extra control and the reset arrow, in the one row layout every slider shares. */
export function SliderReadout({ number, extra, resetLabel, resetDisabled, onReset }: SliderReadoutProps): React.JSX.Element {
  return (
    <span className="ui-slider__readout">
      {number}
      {extra}
      <IconButton label={resetLabel} icon={<Icon name="reset" />} compact disabled={resetDisabled} onClick={onReset} />
    </span>
  );
}

interface SliderFrameProps {
  label: string;
  hint?: string | undefined; // the sentence under the label's tooltip heading; none: the label alone
  layout: 'stacked' | 'row';
  marks: boolean;
  disabled: boolean;
  resettable: boolean;
  track: ReactNode;
  valueText: ReactNode;
}

/** The label, the track and the value of one slider, laid out as a row or stacked; Slider and RangeSlider both draw through it. */
export function SliderFrame({ label, hint, layout, marks, disabled, resettable, track, valueText }: SliderFrameProps): React.JSX.Element {
  const labelText = <Tooltip heading={label} text={hint ?? ''}><span className="ui-slider__label">{label}</span></Tooltip>;
  const marked = marks ? '' : undefined;
  const dragPart = (part: ReactNode): React.JSX.Element => <span className="ui-slider__part" {...SKIP_TOOLTIP}>{part}</span>; // no pointer tooltip over the track or the number (compositing R49)
  if (layout === 'row') {
    return (
      <div className="ui-slider" data-layout="row" data-resettable={resettable ? '' : undefined} data-disabled={disabled ? '' : undefined} data-marks={marked}>
        {labelText}
        {dragPart(track)}
        {dragPart(valueText)}
      </div>
    );
  }
  return (
    <div className="ui-slider" data-disabled={disabled ? '' : undefined} data-marks={marked}>
      <div className="ui-slider__header">
        {labelText}
        {dragPart(valueText)}
      </div>
      {dragPart(track)}
    </div>
  );
}

export function Slider({ label, hint, value, min, max, step = 1, onChange, format = String, disabled = false, layout = 'stacked', readout, resetTo, onReset, marks = false, extra }: SliderProps): React.JSX.Element {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const number = readout ?? <output className="ui-slider__value">{format(value)}</output>;
  const resettable = resetTo !== undefined;
  const valueText = resettable ? (
    <SliderReadout number={number} extra={extra} resetLabel={`Reset ${label}`} resetDisabled={disabled || value === resetTo} onReset={onReset ?? (() => onChange(resetTo))} />
  ) : extra === undefined ? (
    number
  ) : (
    <span className="ui-slider__readout">
      {number}
      {extra}
    </span>
  );
  const input = (
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
  const track = marks ? (
    <span className="ui-slider__track">
      {input}
      <SliderTicks />
    </span>
  ) : (
    input
  );
  return <SliderFrame label={label} hint={hint} layout={layout} marks={marks} disabled={disabled} resettable={resettable} track={track} valueText={valueText} />;
}
