// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from '../../src/ui-kit';

afterEach(cleanup);

const tabs = [
  { value: 'textures', label: 'Textures' },
  { value: 'uv', label: 'UV' },
  { value: 'projections', label: 'Projections', disabled: true },
];

describe('Tabs', () => {
  it('R22 it is a labelled tab list with the selected tab marked', () => {
    render(<Tabs label="Left panel" tabs={tabs} value="uv" onChange={() => undefined} />);
    expect(screen.getByRole('tablist', { name: 'Left panel' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'UV' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Textures' }).getAttribute('aria-selected')).toBe('false');
  });

  it('R22 clicking a tab reports its value', async () => {
    const onChange = vi.fn();
    render(<Tabs label="Left panel" tabs={tabs} value="textures" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'UV' }));
    expect(onChange).toHaveBeenCalledWith('uv');
  });

  it('R22 only the selected tab is in the tab order, and arrow keys move to the next enabled tab', async () => {
    const onChange = vi.fn();
    render(<Tabs label="Left panel" tabs={tabs} value="textures" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Textures' }).getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('tab', { name: 'UV' }).getAttribute('tabindex')).toBe('-1');
    screen.getByRole('tab', { name: 'Textures' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('uv');
  });

  it('R22 a disabled tab ignores clicks', async () => {
    const onChange = vi.fn();
    render(<Tabs label="Left panel" tabs={tabs} value="textures" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Projections' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
