// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RangeSlider } from '@shared/ui-kit';

afterEach(cleanup);

const TRACK_WIDTH = 214; // 200 px of travel between the two 7 px insets
type Change = (low: number, high: number) => void;

function renderRange(over: { low?: number; high?: number; min?: number; max?: number; step?: number; onChange?: Change; marks?: boolean } = {}) {
  const onChange = over.onChange ?? vi.fn();
  const view = render(<RangeSlider label="Size" layout="row" min={over.min ?? 0} max={over.max ?? 100} step={over.step ?? 1} low={over.low ?? 0} high={over.high ?? 100} marks={over.marks ?? false} format={(value) => `${value}%`} onChange={onChange} />);
  const track = view.container.querySelector('.ui-range') as HTMLElement;
  track.getBoundingClientRect = () => ({ left: 0, right: TRACK_WIDTH, top: 0, bottom: 18, width: TRACK_WIDTH, height: 18, x: 0, y: 0, toJSON: () => ({}) });
  return { onChange: onChange as ReturnType<typeof vi.fn>, track, ...view };
}
const lowThumb = (): HTMLElement => screen.getByRole('slider', { name: 'Size, low' });
const highThumb = (): HTMLElement => screen.getByRole('slider', { name: 'Size, high' });
const pointAt = (value: number, min = 0, max = 100): number => 7 + ((value - min) / (max - min)) * 200;

describe('ui-kit RangeSlider (compositing R51)', () => {
  it('R51 two markers, each a slider with its own name, value and unit, on one track', () => {
    const { container } = renderRange({ low: 20, high: 70 });
    expect(container.querySelectorAll('.ui-range')).toHaveLength(1);
    expect(lowThumb().getAttribute('aria-valuenow')).toBe('20');
    expect(highThumb().getAttribute('aria-valuenow')).toBe('70');
    expect(lowThumb().getAttribute('aria-valuetext')).toBe('20%');
    expect(highThumb().getAttribute('aria-valuetext')).toBe('70%');
  });

  it('R51 aria-valuemin and aria-valuemax exclude the 3 percent gap between the markers', () => {
    renderRange({ low: 20, high: 70 });
    expect([lowThumb().getAttribute('aria-valuemin'), lowThumb().getAttribute('aria-valuemax')]).toEqual(['0', '67']);
    expect([highThumb().getAttribute('aria-valuemin'), highThumb().getAttribute('aria-valuemax')]).toEqual(['23', '100']);
  });

  it('R51 the yellow filled area runs between the markers', () => {
    const { container } = renderRange({ low: 20, high: 70 });
    const range = container.querySelector('.ui-range') as HTMLElement;
    expect(range.style.getPropertyValue('--range-low')).toBe('0.2');
    expect(range.style.getPropertyValue('--range-high')).toBe('0.7');
    expect(container.querySelector('.ui-range__fill')).not.toBeNull();
  });

  it('R51 the arrow keys move the focused marker by one step, PageUp and PageDown by ten, Home and End to its limit', () => {
    const { onChange } = renderRange({ low: 20, high: 70 });
    fireEvent.keyDown(lowThumb(), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(21, 70);
    fireEvent.keyDown(lowThumb(), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(19, 70);
    fireEvent.keyDown(highThumb(), { key: 'PageUp' });
    expect(onChange).toHaveBeenLastCalledWith(20, 80);
    fireEvent.keyDown(highThumb(), { key: 'PageDown' });
    expect(onChange).toHaveBeenLastCalledWith(20, 60);
    fireEvent.keyDown(lowThumb(), { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(0, 70);
    fireEvent.keyDown(lowThumb(), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(67, 70);
    fireEvent.keyDown(highThumb(), { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(20, 23);
    fireEvent.keyDown(highThumb(), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(20, 100);
  });

  it('R51 low never passes high: it stops at the gap, and the other marker is not pushed', () => {
    const { onChange } = renderRange({ low: 60, high: 62 });
    fireEvent.keyDown(lowThumb(), { key: 'PageUp' });
    expect(onChange).toHaveBeenLastCalledWith(59, 62); // 62 - 3 = 59: it moves down to the gap
    cleanup();
    const second = renderRange({ low: 20, high: 22 });
    fireEvent.keyDown(highThumb(), { key: 'PageDown' });
    expect(second.onChange).toHaveBeenLastCalledWith(20, 23);
  });

  it('R51 a press on the track moves the nearer marker there, and starts dragging it', () => {
    const { onChange, track } = renderRange({ low: 20, high: 70 });
    fireEvent.pointerDown(track, { clientX: pointAt(30), pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(30, 70);
    fireEvent.pointerMove(track, { clientX: pointAt(40), pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(40, 70);
    fireEvent.pointerUp(track, { clientX: pointAt(40), pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: pointAt(55), pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(40, 70); // released: a move changes nothing
  });

  it('R51 a press nearer the high marker moves the high one; on a tie the low one', () => {
    const near = renderRange({ low: 20, high: 70 });
    fireEvent.pointerDown(near.track, { clientX: pointAt(60), pointerId: 1 });
    expect(near.onChange).toHaveBeenLastCalledWith(20, 60);
    cleanup();
    const tie = renderRange({ low: 20, high: 60 });
    fireEvent.pointerDown(tie.track, { clientX: pointAt(40), pointerId: 1 });
    expect(tie.onChange).toHaveBeenLastCalledWith(40, 60);
  });

  it('R51 dragging a marker past the other stops at the gap', () => {
    const { onChange, track } = renderRange({ low: 20, high: 50 });
    fireEvent.pointerDown(track, { clientX: pointAt(20), pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: pointAt(90), pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(47, 50);
  });

  it('R51 a value follows the step', () => {
    const { onChange, track } = renderRange({ low: 0, high: 100, step: 5 });
    fireEvent.pointerDown(track, { clientX: pointAt(37), pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(35, 100);
  });

  it('R51 the reset arrow puts both markers back at the two ends, and is disabled while they are there', () => {
    const { onChange } = renderRange({ low: 20, high: 70 });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Size' }));
    expect(onChange).toHaveBeenLastCalledWith(0, 100);
    cleanup();
    renderRange({ low: 0, high: 100 });
    expect((screen.getByRole('button', { name: 'Reset Size' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R51 R46 the readout shows both ends, and the muted marks are drawn when asked', () => {
    const { container } = renderRange({ low: 20, high: 70, marks: true });
    expect(container.querySelector('.ui-slider__value')?.textContent).toBe('20%–70%');
    expect(container.querySelectorAll('.ui-slider__mark')).toHaveLength(3);
    expect(container.querySelector('.ui-slider')?.hasAttribute('data-marks')).toBe(true);
  });
});
