import { memo, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { SliderFrame, SliderReadout, SliderTicks } from './Slider';
import './Slider.css';

/** The two markers stay at least this share of the range apart, so both stay visible and selectable (compositing R51). */
export const RANGE_MIN_GAP = 0.03;
const THUMB_INSET_PX = 7; // the centre of a Slider's thumb travels this far in from each end; the marks and the fill use the same travel
const PAGE_STEPS = 10;

type Which = 'low' | 'high';

interface RangeSliderProps {
  label: string; // the row's label; the markers are named "<label>, low" and "<label>, high"
  hint?: string; // what the setting does: the sentence of the label's tooltip
  low: number;
  high: number;
  min: number;
  max: number;
  step?: number;
  onChange: (low: number, high: number) => void;
  format?: (value: number) => string; // also the unit in each marker's aria-valuetext
  layout?: 'stacked' | 'row';
  marks?: boolean; // the muted ticks and the stronger track of Slider (compositing R46)
  extra?: ReactNode; // a control between the readout and the reset arrow, e.g. the dice
}

const decimalsOf = (step: number): number => (Number.isInteger(step) ? 0 : Math.min(8, String(step).split('.')[1]?.length ?? 0));

/**
 * Compositing R51: a track with two thin markers and the accent-coloured area between them. Either marker moves anywhere in [min, max]; low never passes high, and
 * a gap of RANGE_MIN_GAP of the range keeps them distinct (the one being moved stops at the gap, it does not push the other). A press on the track moves the nearer
 * marker (low on a tie) and drags it. The reset arrow puts both markers back at the two ends. Memoised: pass stable callbacks.
 */
function RangeSliderView({ label, hint, low, high, min, max, step = 1, onChange, format = String, layout = 'stacked', marks = false, extra }: RangeSliderProps): React.JSX.Element {
  const track = useRef<HTMLSpanElement>(null);
  const lowThumb = useRef<HTMLSpanElement>(null);
  const highThumb = useRef<HTMLSpanElement>(null);
  const dragging = useRef<Which | null>(null);
  const span = max - min;
  const gap = span * RANGE_MIN_GAP;
  const decimals = decimalsOf(step);
  const fractionOf = (value: number): number => (span > 0 ? (value - min) / span : 0);
  const limits = (which: Which): [number, number] => (which === 'low' ? [min, high - gap] : [low + gap, max]);

  const move = (which: Which, raw: number): void => {
    const [floor, ceiling] = limits(which);
    const stepped = Number((min + Math.round((raw - min) / step) * step).toFixed(decimals));
    const next = Math.min(Math.max(stepped, floor), ceiling);
    if (which === 'low' ? next !== low : next !== high) onChange(which === 'low' ? next : low, which === 'low' ? high : next);
  };
  const valueAt = (clientX: number): number => {
    const box = track.current!.getBoundingClientRect();
    const travel = box.width - 2 * THUMB_INSET_PX;
    const along = travel > 0 ? (clientX - box.left - THUMB_INSET_PX) / travel : 0;
    return min + Math.min(Math.max(along, 0), 1) * span;
  };

  const onPointerDown = (event: PointerEvent<HTMLSpanElement>): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    const at = valueAt(event.clientX);
    const which: Which = Math.abs(at - low) <= Math.abs(at - high) ? 'low' : 'high';
    dragging.current = which;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    (which === 'low' ? lowThumb : highThumb).current?.focus();
    move(which, at);
  };
  const onPointerMove = (event: PointerEvent<HTMLSpanElement>): void => {
    if (dragging.current !== null) move(dragging.current, valueAt(event.clientX));
  };
  const onPointerEnd = (): void => {
    dragging.current = null;
  };

  const onKeyDown = (which: Which) => (event: KeyboardEvent<HTMLSpanElement>): void => {
    const [floor, ceiling] = limits(which);
    const current = which === 'low' ? low : high;
    const target: Record<string, number> = {
      ArrowRight: current + step, ArrowUp: current + step, ArrowLeft: current - step, ArrowDown: current - step,
      PageUp: current + PAGE_STEPS * step, PageDown: current - PAGE_STEPS * step, Home: floor, End: ceiling,
    };
    const next = target[event.key];
    if (next === undefined) return;
    event.preventDefault();
    move(which, next);
  };

  const thumb = (which: Which): React.JSX.Element => {
    const [floor, ceiling] = limits(which);
    const value = which === 'low' ? low : high;
    return (
      <span
        ref={which === 'low' ? lowThumb : highThumb}
        role="slider"
        tabIndex={0}
        className="ui-range__thumb"
        aria-label={`${label}, ${which}`}
        aria-valuemin={floor}
        aria-valuemax={ceiling}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        style={{ '--range-position': fractionOf(value) } as CSSProperties}
        onKeyDown={onKeyDown(which)}
      />
    );
  };

  const atTheEnds = low <= min && high >= max;
  const range = (
    <span
      ref={track}
      className="ui-range"
      style={{ '--range-low': fractionOf(low), '--range-high': fractionOf(high) } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <span className="ui-range__rail" />
      <span className="ui-range__fill" />
      {marks && <SliderTicks />}
      {thumb('low')}
      {thumb('high')}
    </span>
  );
  const number = <output className="ui-slider__value" data-range="">{`${format(low)}–${format(high)}`}</output>;
  return (
    <SliderFrame
      label={label}
      hint={hint}
      layout={layout}
      marks={marks}
      disabled={false}
      resettable
      track={range}
      valueText={<SliderReadout number={number} extra={extra} resetLabel={`Reset ${label}`} resetDisabled={atTheEnds} onReset={() => onChange(min, max)} />}
    />
  );
}

export const RangeSlider = memo(RangeSliderView);
