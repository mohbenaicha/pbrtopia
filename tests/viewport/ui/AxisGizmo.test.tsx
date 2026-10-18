// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Quaternion } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxisGizmo } from '../../../src/viewport/ui/AxisGizmo';

afterEach(cleanup);

describe('AxisGizmo', () => {
  it('R13 it offers six buttons, one to look from each side of the model', () => {
    render(<AxisGizmo quaternion={new Quaternion()} onSelectAxis={() => undefined} />);
    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(names.sort()).toEqual(['View from +X', 'View from +Y', 'View from +Z', 'View from -X', 'View from -Y', 'View from -Z']);
  });

  it('R13 clicking a disc asks for the view from that axis', async () => {
    const onSelectAxis = vi.fn();
    render(<AxisGizmo quaternion={new Quaternion()} onSelectAxis={onSelectAxis} />);
    await userEvent.click(screen.getByRole('button', { name: 'View from -Y' }));
    expect(onSelectAxis).toHaveBeenCalledWith('-y');
  });

  it('R13 the disc facing the viewer sits on top of the others', () => {
    render(<AxisGizmo quaternion={new Quaternion()} onSelectAxis={() => undefined} />);
    const stackOrder = (name: string): number => Number(screen.getByRole('button', { name }).style.zIndex);
    expect(stackOrder('View from +Z')).toBeGreaterThan(stackOrder('View from +X'));
    expect(stackOrder('View from +X')).toBeGreaterThan(stackOrder('View from -Z'));
  });

  it('R13 the three positive discs show their letter and the negative ones show none', () => {
    render(<AxisGizmo quaternion={new Quaternion()} onSelectAxis={() => undefined} />);
    expect(screen.getByRole('button', { name: 'View from +X' }).textContent).toBe('X');
    expect(screen.getByRole('button', { name: 'View from -X' }).textContent).toBe('');
  });
});
