// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CropPanel } from '@mat/app/panels/tools/CropPanel';
import { openTooltipTextOf } from '../../../../support/tooltipDescription';

afterEach(cleanup);

function show(onApply = vi.fn(async () => ({ ok: true }) as { ok: boolean; message?: string }), size = 2048) {
  const onClose = vi.fn();
  const onChange = vi.fn();
  const onMark = vi.fn();
  render(<CropPanel size={size} onChange={onChange} onMark={onMark} onApply={onApply} onClose={onClose} />);
  return { onApply, onClose, onChange, onMark };
}
const button = (name: string): HTMLButtonElement => screen.getByRole('button', { name }) as HTMLButtonElement;
const amount = (): HTMLInputElement => screen.getByRole('slider', { name: 'Pixels to remove' }) as HTMLInputElement;
const amountBox = (): HTMLInputElement => screen.getByRole('spinbutton', { name: 'Pixels to remove value' }) as HTMLInputElement;
const setAmount = (value: string): void => void fireEvent.change(amount(), { target: { value } });

describe('materialgen/app CropPanel', () => {
  it('R29 the panel has the Top, Left, Right and Bottom edge handles, a 1 to 10 px slider that starts at 8, and shows the whole image', () => {
    show();
    for (const name of ['Top', 'Left', 'Right', 'Bottom']) expect(button(name)).toBeTruthy();
    expect([amount().min, amount().max, amount().step, amount().value]).toEqual(['1', '10', '1', '8']);
    expect(amountBox().value).toBe('8');
    expect(screen.getByText('2048 x 2048 px, scaled to 2048 x 2048')).toBeTruthy();
  });

  it('R29 R57 the amount is a label, slider, number and reset row like Fade start, and the old text box and text buttons are gone', () => {
    show();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(amount().closest('.ui-slider')?.getAttribute('data-layout')).toBe('row');
    expect(screen.getByRole('button', { name: 'Reset Pixels to remove' })).toBeTruthy();
    for (const name of ['Top', 'Left', 'Right', 'Bottom']) expect(button(name).textContent).toBe(''); // a handle on the plane, not a labelled button
  });

  it('R71 the picker carries edge handles only', () => {
    show();
    expect(screen.queryByRole('button', { name: 'TL' })).toBeNull();
    expect(screen.getByTestId('plane-picker-plane')).toBeTruthy();
  });

  it('R52 R57 it is a panel, not a dialog: nothing covers the viewport, and there is no help paragraph', () => {
    show();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: 'Crop' })).toBeTruthy();
    expect(document.querySelector('.tool-dialog__hint, .ui-text-input__hint')).toBeNull();
  });

  it('R57 each edge button says in its tooltip what it removes', () => {
    show();
    expect(openTooltipTextOf(button('Top'))).toBe('Remove 8 px from the top. Click to trim the map from this edge; the viewport marks where the cut falls.');
    setAmount('3');
    expect(openTooltipTextOf(button('Right'))).toBe('Remove 3 px from the right. Click to trim the map from this edge; the viewport marks where the cut falls.');
  });

  it('R53 R55 every click on an edge button reports the new rectangle at once, so the viewport follows each click', () => {
    const { onChange } = show();
    fireEvent.click(button('Top'));
    expect(onChange).toHaveBeenLastCalledWith({ x: 0, y: 8, width: 2048, height: 2040 });
    fireEvent.click(button('Left'));
    expect(onChange).toHaveBeenLastCalledWith({ x: 8, y: 8, width: 2040, height: 2040 });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('R53 a click that is ignored (too little would remain) reports nothing new', () => {
    const { onChange } = show(undefined, 32);
    setAmount('10');
    fireEvent.click(button('Top')); // 32 - 10 = 22, allowed
    fireEvent.click(button('Top')); // 22 - 10 = 12 < 16, ignored
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('R55 hovering an edge handle marks that edge in the viewport, and leaving it clears the mark', () => {
    const { onMark } = show();
    for (const [name, edge] of [['Top', 'top'], ['Left', 'left'], ['Right', 'right'], ['Bottom', 'bottom']] as const) {
      fireEvent.mouseEnter(button(name));
      expect(onMark).toHaveBeenLastCalledWith(edge);
      fireEvent.mouseLeave(button(name));
      expect(onMark).toHaveBeenLastCalledWith(null);
    }
  });

  it('R55 keyboard focus on an edge button marks it the same way', () => {
    const { onMark } = show();
    fireEvent.focus(button('Bottom'));
    expect(onMark).toHaveBeenLastCalledWith('bottom');
    fireEvent.blur(button('Bottom'));
    expect(onMark).toHaveBeenLastCalledWith(null);
  });

  it('R52 Reset shows the whole picture again in the viewport', () => {
    const { onChange } = show();
    fireEvent.click(button('Top'));
    fireEvent.click(button('Reset'));
    expect(onChange).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 2048, height: 2048 });
  });

  it('R52 Escape is Cancel', () => {
    const { onClose, onApply } = show();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('R29 each click removes the amount from that edge and the panel shows the rectangle', () => {
    show();
    fireEvent.click(button('Top'));
    fireEvent.click(button('Left'));
    expect(screen.getByText('2040 x 2040 px, scaled to 2048 x 2048')).toBeTruthy();
    setAmount('10');
    fireEvent.click(button('Right'));
    expect(screen.getByText('2030 x 2040 px, scaled to 2048 x 2048')).toBeTruthy();
  });

  it('R29 a number typed outside 1 to 10 is brought into range when the box is left', () => {
    show();
    fireEvent.change(amountBox(), { target: { value: '30' } });
    fireEvent.blur(amountBox());
    expect(amount().value).toBe('10');
    fireEvent.change(amountBox(), { target: { value: '0' } });
    fireEvent.blur(amountBox());
    expect(amount().value).toBe('1');
  });

  it('R29 the reset arrow of the row puts the amount back to 8 and the click then removes 8', () => {
    show();
    setAmount('2');
    fireEvent.click(screen.getByRole('button', { name: 'Reset Pixels to remove' }));
    expect(amount().value).toBe('8');
    expect(openTooltipTextOf(button('Top'))).toBe('Remove 8 px from the top. Click to trim the map from this edge; the viewport marks where the cut falls.');
  });

  it('R29 a click that would leave fewer than 16 pixels is ignored', () => {
    show(undefined, 32);
    setAmount('10');
    fireEvent.click(button('Top'));
    fireEvent.click(button('Top'));
    expect(screen.getByText('32 x 22 px, scaled to 32 x 32')).toBeTruthy();
  });

  it('R29 Apply is disabled for the full rectangle, and Reset restores it', () => {
    show();
    expect(button('Apply').disabled).toBe(true);
    fireEvent.click(button('Bottom'));
    expect(button('Apply').disabled).toBe(false);
    fireEvent.click(button('Reset'));
    expect(button('Apply').disabled).toBe(true);
    expect(screen.getByText('2048 x 2048 px, scaled to 2048 x 2048')).toBeTruthy();
  });

  it('R30 Apply hands the rectangle on and closes when it worked', async () => {
    const { onApply, onClose } = show();
    fireEvent.click(button('Top'));
    fireEvent.click(button('Apply'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onApply).toHaveBeenCalledWith({ x: 0, y: 8, width: 2048, height: 2040 });
  });

  it('R12 a failed Apply keeps the panel open with the message', async () => {
    const { onClose } = show(vi.fn(async () => ({ ok: false, message: 'Image is too large for this graphics card.' })));
    fireEvent.click(button('Top'));
    fireEvent.click(button('Apply'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Image is too large for this graphics card.'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('R12 an Apply that throws keeps the panel open and says nothing changed', async () => {
    const { onClose } = show(vi.fn(async () => { throw new Error('disk'); }));
    fireEvent.click(button('Top'));
    fireEvent.click(button('Apply'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Could not save the result. Nothing changed.'));
    expect(onClose).not.toHaveBeenCalled();
    expect((button('Apply') as HTMLButtonElement).getAttribute('aria-busy')).not.toBe('true');
  });

  it('R17 while Apply is working, Cancel is disabled', async () => {
    let finish: (outcome: { ok: boolean }) => void = () => undefined;
    show(vi.fn(() => new Promise<{ ok: boolean }>((resolve) => { finish = resolve; })));
    fireEvent.click(button('Top'));
    fireEvent.click(button('Apply'));
    await waitFor(() => expect((button('Cancel') as HTMLButtonElement).disabled).toBe(true));
    finish({ ok: true });
  });

  it('R9 Cancel closes without applying', () => {
    const { onApply, onClose } = show();
    fireEvent.click(button('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });
});
