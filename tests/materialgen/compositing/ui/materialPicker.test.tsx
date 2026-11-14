// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '../../../../src/materialgen/compositing/atlas/material_balls.json';
import { MaterialPicker } from '@mat/compositing/ui/MaterialPicker';
import { MaterialBall } from '@mat/compositing/ui/MaterialBall';

afterEach(cleanup);

const known = { name: manifest.names[1]!, roughness: 0.4, metal: 1, rgb: [200, 100, 50] as const };
const unknown = { name: 'Not in the sheet', roughness: 0.4, metal: 0, rgb: [10, 20, 30] as const };

describe('materialgen/compositing MaterialBall and MaterialPicker (R7 R42 R54)', () => {
  it('R54 a ball of a known material is its cell of the one sheet, cut by CSS', () => {
    const { container } = render(<MaterialBall material={known} size={80} />);
    const ball = container.querySelector<HTMLElement>('[data-ball-cell]')!;
    expect(ball.getAttribute('data-ball-cell')).toBe('1');
    expect(ball.style.backgroundImage).toContain('url(');
    expect(ball.style.backgroundPosition).toBe('-80px 0px');
    expect(ball.style.width).toBe('80px');
  });

  it('R54 a material with no cell is the flat circle of its colour', () => {
    const { container } = render(<MaterialBall material={unknown} size={44} />);
    expect(container.querySelector('[data-ball-cell]')).toBeNull();
    expect(container.querySelector('.material-ball--flat')).not.toBeNull();
  });

  it('R54 the picker draws nothing at run time: its tiles are cuts of the sheet and there is no canvas', async () => {
    render(<MaterialPicker loadTable={() => Promise.resolve([known])} onChoose={vi.fn()} onClose={vi.fn()} />);
    const tile = await screen.findByRole('button', { name: new RegExp(known.name) });
    expect(tile.querySelector('[data-ball-cell]')).not.toBeNull();
    expect(document.querySelector('canvas')).toBeNull();
  });

  it('R7 choosing a tile hands over the material', async () => {
    const onChoose = vi.fn();
    render(<MaterialPicker loadTable={() => Promise.resolve([known])} onChoose={onChoose} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(known.name) }));
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ name: known.name, roughness: 0.4 }));
  });
});
