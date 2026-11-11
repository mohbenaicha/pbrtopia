// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planMirror, type Quadrant } from '@mat/imageops';
import { MirrorPanel } from '@mat/app/panels/tools/MirrorPanel';

afterEach(cleanup);

function show(onApply = vi.fn(async () => ({ ok: true }) as { ok: boolean; message?: string })) {
  const onClose = vi.fn();
  const onChange = vi.fn();
  render(<MirrorPanel onChange={onChange} onApply={onApply} onClose={onClose} />);
  return { onApply, onClose, onChange };
}
const quadrant = (name: Quadrant): HTMLInputElement => screen.getByRole('checkbox', { name }) as HTMLInputElement;
const mode = (name: string): HTMLInputElement => screen.getByRole('radio', { name }) as HTMLInputElement;
const apply = (): HTMLButtonElement => screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement;

describe('materialgen/app MirrorPanel', () => {
  it('R52 R57 it is a panel, not a dialog, with the four toggles in the picture\'s own layout and no help paragraph', () => {
    show();
    expect(screen.queryByRole('dialog')).toBeNull();
    const grid = screen.getByRole('group', { name: 'Quadrants to mirror' });
    expect([...grid.querySelectorAll('input[type=checkbox]')].map((box) => box.getAttribute('aria-label') ?? (box.closest('label')?.textContent ?? ''))).toEqual(['TL', 'TR', 'BL', 'BR']);
    expect(grid.className).toContain('mirror-grid'); // a 2 x 2 grid in CSS: TL TR over BL BR
    expect(document.querySelector('.tool-dialog__hint')).toBeNull();
  });

  it('R56 the viewport is told the plan and the selected quadrants when the panel opens and on every change', () => {
    const { onChange } = show();
    expect(onChange).toHaveBeenLastCalledWith(planMirror('pair', new Set<Quadrant>(['TL', 'TR'])), new Set(['TL', 'TR']));
    fireEvent.click(quadrant('TR'));
    expect(onChange).toHaveBeenLastCalledWith(planMirror('x', new Set<Quadrant>(['TL'])), new Set(['TL']));
    fireEvent.click(mode('Around'));
    expect(onChange).toHaveBeenLastCalledWith(planMirror('around', new Set<Quadrant>(['TL'])), new Set(['TL']));
  });

  it('R32 clicking the only selected quadrant off does nothing, and a diagonal click replaces it: never empty, never a diagonal pair', () => {
    const { onChange } = show();
    fireEvent.click(quadrant('TR')); // TL alone
    onChange.mockClear();
    fireEvent.click(quadrant('TL'));
    expect(quadrant('TL').checked).toBe(true);
    fireEvent.click(quadrant('BR')); // diagonal to TL
    expect(quadrant('TL').checked).toBe(false);
    expect(quadrant('BR').checked).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(planMirror('x', new Set<Quadrant>(['BR'])), new Set(['BR']));
  });

  it('R32 with a half selected, a third click keeps the first quadrant that shares an edge with it, so at most two are ever selected', () => {
    show();
    fireEvent.click(quadrant('BL')); // TL and TR -> TL and BL
    const checked = (['TL', 'TR', 'BL', 'BR'] as const).filter((name) => quadrant(name).checked);
    expect(checked).toEqual(['TL', 'BL']);
    expect(mode('Pair').disabled).toBe(false);
  });

  it('R52 Reset shows the pair of the start selection again, and Escape is Cancel', () => {
    const { onChange, onClose, onApply } = show();
    fireEvent.click(quadrant('BL'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onChange).toHaveBeenLastCalledWith(planMirror('pair', new Set<Quadrant>(['TL', 'TR'])), new Set(['TL', 'TR']));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('R32 the quadrants TL and TR start selected, with the pair mode chosen', () => {
    show();
    expect(quadrant('TL').checked).toBe(true);
    expect(quadrant('TR').checked).toBe(true);
    expect(quadrant('BL').checked).toBe(false);
    expect(quadrant('BR').checked).toBe(false);
    expect(mode('Pair').getAttribute('aria-checked')).toBe('true');
    expect(apply().disabled).toBe(false);
  });

  it('R32 a mode is enabled only when the selection fits it', () => {
    show();
    expect(mode('Pair').disabled).toBe(false);
    for (const name of ['X', 'Y', 'Around']) expect(mode(name).disabled).toBe(true);
    fireEvent.click(quadrant('TR'));
    expect(mode('Pair').disabled).toBe(true);
    for (const name of ['X', 'Y', 'Around']) expect(mode(name).disabled).toBe(false);
  });

  it('R32 when the chosen mode no longer fits, the first mode that does is chosen', () => {
    show();
    fireEvent.click(quadrant('TR'));
    expect(mode('X').getAttribute('aria-checked')).toBe('true');
  });

  it('R32 Apply is never disabled by the selection, whatever is clicked', () => {
    show();
    for (const name of ['TL', 'TR', 'BL', 'BR', 'TL', 'BR', 'BL', 'TR'] as const) {
      fireEvent.click(quadrant(name));
      expect(apply().disabled).toBe(false);
    }
  });

  it('R32 Apply hands the plan of the chosen mode on and closes when it worked', async () => {
    const { onApply, onClose } = show();
    fireEvent.click(apply());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onApply).toHaveBeenCalledWith(planMirror('pair', new Set<Quadrant>(['TL', 'TR'])));
  });

  it('R32 a one-quadrant selection can be mirrored around', async () => {
    const { onApply } = show();
    fireEvent.click(quadrant('TR'));
    fireEvent.click(mode('Around'));
    fireEvent.click(apply());
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(onApply).toHaveBeenCalledWith(planMirror('around', new Set<Quadrant>(['TL'])));
  });

  it('R12 a failed Apply keeps the panel open with the message', async () => {
    const { onClose } = show(vi.fn(async () => ({ ok: false, message: 'Could not apply (graphics error). Nothing changed.' })));
    fireEvent.click(apply());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Could not apply (graphics error). Nothing changed.'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('R17 Reset returns to TL and TR with the pair mode', () => {
    show();
    fireEvent.click(quadrant('BL'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(quadrant('BL').checked).toBe(false);
    expect(mode('Pair').getAttribute('aria-checked')).toBe('true');
  });
});
