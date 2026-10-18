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

  it('R1 the filled part of the track follows the value through a CSS variable', () => {
    render(<Slider label="Zoom" value={250} min={100} max={400} step={10} onChange={() => undefined} />);
    const slider = screen.getByRole('slider', { name: 'Zoom' }) as HTMLInputElement;
    expect(slider.style.getPropertyValue('--slider-fill')).toBe('50%');
  });
});
