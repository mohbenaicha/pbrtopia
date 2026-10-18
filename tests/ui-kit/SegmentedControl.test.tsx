// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from '../../src/ui-kit';

afterEach(cleanup);

const modes = [
  { value: 'shaded', label: 'Shaded' },
  { value: 'albedo', label: 'Albedo' },
  { value: 'normal', label: 'Normal', disabled: true },
  { value: 'rough', label: 'Rough' },
];

describe('SegmentedControl', () => {
  it('R22 it is a labelled radio group with the selected option checked', () => {
    render(<SegmentedControl label="Shading mode" options={modes} value="albedo" onChange={() => undefined} />);
    expect(screen.getByRole('radiogroup', { name: 'Shading mode' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Albedo' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Shaded' }).getAttribute('aria-checked')).toBe('false');
  });

  it('R22 clicking an option reports its value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedControl label="Shading mode" options={modes} value="shaded" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Rough' }));
    expect(onChange).toHaveBeenCalledWith('rough');
  });

  it('R22 a disabled option cannot be chosen and arrow keys skip it', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedControl label="Shading mode" options={modes} value="albedo" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Normal' }));
    expect(onChange).not.toHaveBeenCalled();
    screen.getByRole('radio', { name: 'Albedo' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('rough');
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('shaded');
  });

  it('R22 only the selected option is in the tab order', () => {
    render(<SegmentedControl label="Shading mode" options={modes} value="albedo" onChange={() => undefined} />);
    expect(screen.getByRole('radio', { name: 'Albedo' }).tabIndex).toBe(0);
    expect(screen.getByRole('radio', { name: 'Shaded' }).tabIndex).toBe(-1);
  });

  it('R22 a disabled control ignores every click', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedControl label="Shading mode" options={modes} value="shaded" onChange={onChange} disabled />);
    await user.click(screen.getByRole('radio', { name: 'Albedo' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
