// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeshPicker } from '../../../../src/materialgen/preview/ui/MeshPicker';

afterEach(cleanup);

const setup = (mesh: 'ball' | 'plane' | 'materialBall' = 'ball') => {
  const onChoose = vi.fn();
  render(<MeshPicker mesh={mesh} onChoose={onChoose} />);
  return { onChoose };
};

describe('materialgen/preview R27 the Mesh picker', () => {
  it('R27 shows the current mesh and is named "Preview mesh: <current name>"', () => {
    setup('plane');
    expect(screen.getByRole('button', { name: 'Preview mesh: Plane' }).getAttribute('data-testid')).toBe('preview-mesh-picker');
  });

  it('R27 a click opens a menu of the three meshes with the current one marked', async () => {
    setup('materialBall');
    await userEvent.click(screen.getByRole('button', { name: 'Preview mesh: Material ball' }));
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((item) => item.textContent)).toEqual(['Ball', 'Plane', 'Material ball']);
    expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
  });

  it('R27 choosing a mesh applies it and closes the menu', async () => {
    const { onChoose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Preview mesh: Ball' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Plane' }));
    expect(onChoose).toHaveBeenCalledWith('plane');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('R27 arrow keys move, Enter chooses', async () => {
    const { onChoose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Preview mesh: Ball' }));
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Ball' }));
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Plane' }));
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Ball' })); // wraps around
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(onChoose).toHaveBeenCalledWith('materialBall');
  });

  it('R27 Escape closes with no change', async () => {
    const { onChoose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Preview mesh: Ball' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('R27 a click outside closes it', async () => {
    const { onChoose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Preview mesh: Ball' }));
    await userEvent.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onChoose).not.toHaveBeenCalled();
  });
});
