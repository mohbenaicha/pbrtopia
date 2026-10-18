// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraToggle } from '../../../src/viewport/ui/CameraToggle';

afterEach(cleanup);

describe('CameraToggle', () => {
  it('R12 it shows the icon of the current projection and no Ortho or Persp text', () => {
    const { container, rerender } = render(<CameraToggle projection="perspective" onToggle={() => undefined} />);
    expect(container.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('perspective');
    expect(container.textContent).toBe('');
    rerender(<CameraToggle projection="orthographic" onToggle={() => undefined} />);
    expect(container.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('orthographic');
    expect(container.textContent).toBe('');
  });

  it('R12 its name says the current camera and what a click does', () => {
    const { rerender } = render(<CameraToggle projection="perspective" onToggle={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Perspective camera, switch to orthographic' })).toBeTruthy();
    rerender(<CameraToggle projection="orthographic" onToggle={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Orthographic camera, switch to perspective' })).toBeTruthy();
  });

  it('R12 clicking it asks for the other projection', async () => {
    const onToggle = vi.fn();
    render(<CameraToggle projection="perspective" onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith('orthographic');
  });
});
