// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Slider } from '../../src/ui-kit';

afterEach(cleanup);

describe('Slider', () => {
  it('R22 it is a labelled slider showing its value through the formatter', () => {
    render(<Slider label="Zoom" value={150} min={100} max={400} step={10} onChange={() => undefined} format={(value) => `${value}%`} />);
    const slider = screen.getByRole('slider', { name: 'Zoom' }) as HTMLInputElement;
    expect(slider.value).toBe('150');
    expect(screen.getByText('150%')).toBeTruthy();
  });

  it('R22 moving it reports a number', () => {
    const onChange = vi.fn();
    render(<Slider label="Zoom" value={150} min={100} max={400} step={10} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Zoom' }), { target: { value: '220' } });
    expect(onChange).toHaveBeenCalledWith(220);
  });

  it('R22 a disabled slider cannot be focused or moved', () => {
    const onChange = vi.fn();
    render(<Slider label="Zoom" value={150} min={100} max={400} step={10} onChange={onChange} disabled />);
    const slider = screen.getByRole('slider', { name: 'Zoom' }) as HTMLInputElement;
    expect(slider.disabled).toBe(true);
  });

  it('R22 in the row layout the label, the track and the value sit on one line in that order', () => {
    render(<Slider label="Contrast" value={0.55} min={0} max={3} step={0.01} onChange={() => undefined} format={(value) => value.toFixed(2)} layout="row" />);
    const slider = screen.getByRole('slider', { name: 'Contrast' });
    const label = screen.getByText('Contrast');
    const value = screen.getByText('0.55');
    expect(slider.closest('.ui-slider')?.getAttribute('data-layout')).toBe('row');
    expect(label.compareDocumentPosition(slider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(slider.compareDocumentPosition(value) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(label.closest('.ui-slider__header')).toBeNull(); // no header row above the track: the label is a child of the row itself
    expect(label.parentElement).toBe(slider.closest('.ui-slider'));
  });

  it('R23 a readout given by the caller replaces the number readout', () => {
    render(<Slider label="Zoom" value={250} min={100} max={400} onChange={() => undefined} readout={<input aria-label="Zoom value" />} />);
    expect(screen.getByLabelText('Zoom value')).toBeTruthy();
    expect(screen.queryByText('250')).toBeNull();
  });

  it('preview R61 a slider given a default shows a Reset arrow after the number, and a click sets the default', () => {
    const onChange = vi.fn();
    render(<Slider label="Contrast" value={0.55} min={0} max={3} step={0.01} onChange={onChange} format={(value) => value.toFixed(2)} layout="row" resetTo={1} />);
    const reset = screen.getByRole('button', { name: 'Reset Contrast' }) as HTMLButtonElement;
    const value = screen.getByText('0.55');
    expect(value.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(reset);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('preview R61 the Reset arrow is disabled at the default and while the slider is disabled', () => {
    const { rerender } = render(<Slider label="Contrast" value={1} min={0} max={3} onChange={() => undefined} layout="row" resetTo={1} />);
    expect((screen.getByRole('button', { name: 'Reset Contrast' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<Slider label="Contrast" value={2} min={0} max={3} onChange={() => undefined} layout="row" resetTo={1} disabled />);
    expect((screen.getByRole('button', { name: 'Reset Contrast' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('preview R61 the stacked layout has the Reset arrow too, and a slider with no default has none', () => {
    const { rerender } = render(<Slider label="Zoom" value={150} min={100} max={400} onChange={() => undefined} resetTo={100} />);
    expect(screen.getByRole('button', { name: 'Reset Zoom' })).toBeTruthy();
    rerender(<Slider label="Zoom" value={150} min={100} max={400} onChange={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Reset Zoom' })).toBeNull();
  });

  it('R1 the filled part of the track follows the value through a CSS variable', () => {
    render(<Slider label="Zoom" value={250} min={100} max={400} step={10} onChange={() => undefined} />);
    const slider = screen.getByRole('slider', { name: 'Zoom' }) as HTMLInputElement;
    expect(slider.style.getPropertyValue('--slider-fill')).toBe('50%');
  });
});
