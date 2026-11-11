// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommitSlider } from '../../src/ui-kit/CommitSlider';

afterEach(cleanup);

function setup(value = 0.2, disabled = false) {
  const onCommit = vi.fn();
  render(<CommitSlider label="Roughness of Brick" value={value} onCommit={onCommit} disabled={disabled} />);
  const input = screen.getByLabelText('Roughness of Brick') as HTMLInputElement;
  return { input, onCommit };
}

describe('ui-kit CommitSlider (materialgen masks R50 R51, preview R39)', () => {
  it('R50 while dragging the readout follows the pointer and nothing is committed', () => {
    const { input, onCommit } = setup();
    fireEvent.pointerDown(input);
    fireEvent.change(input, { target: { value: '0.9' } });
    expect(screen.getByText('0.90')).toBeTruthy();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('R50 on release the value commits once', () => {
    const { input, onCommit } = setup();
    fireEvent.pointerDown(input);
    fireEvent.change(input, { target: { value: '0.9' } });
    fireEvent.pointerUp(input);
    fireEvent.pointerUp(window); // the release that reaches the page as well must not commit twice
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(0.9);
  });

  it('R50 a release outside the track commits as well, and a cancelled pointer commits too', () => {
    const first = setup();
    fireEvent.pointerDown(first.input);
    fireEvent.change(first.input, { target: { value: '0.5' } });
    fireEvent.pointerUp(window);
    expect(first.onCommit).toHaveBeenCalledWith(0.5);
    cleanup();
    const second = setup();
    fireEvent.pointerDown(second.input);
    fireEvent.change(second.input, { target: { value: '0.6' } });
    fireEvent.pointerCancel(second.input);
    expect(second.onCommit).toHaveBeenCalledWith(0.6);
  });

  it('R50 a drag that ends on its starting value commits nothing', () => {
    const { input, onCommit } = setup();
    fireEvent.pointerDown(input);
    fireEvent.change(input, { target: { value: '0.9' } });
    fireEvent.change(input, { target: { value: '0.2' } });
    fireEvent.pointerUp(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('R51 keys change the readout and the commit waits for key up', () => {
    const { input, onCommit } = setup();
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    fireEvent.change(input, { target: { value: '0.21' } });
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    fireEvent.change(input, { target: { value: '0.22' } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyUp(input, { key: 'ArrowRight' });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(0.22);
  });

  it('R51 a change still pending when the slider loses focus is committed', () => {
    const { input, onCommit } = setup();
    fireEvent.change(input, { target: { value: '0.4' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(0.4);
  });

  it('R50 after release the readout keeps the new value until the commit has finished', async () => {
    let finish: () => void = () => undefined;
    const onCommit = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<CommitSlider label="Roughness of Brick" value={0.2} onCommit={onCommit} />);
    const input = screen.getByLabelText('Roughness of Brick');
    fireEvent.pointerDown(input);
    fireEvent.change(input, { target: { value: '0.9' } });
    fireEvent.pointerUp(input);
    await Promise.resolve();
    expect(screen.getByText('0.90')).toBeTruthy(); // not back to 0.20 while the bake runs
    finish();
    await waitFor(() => expect(screen.getByText('0.20')).toBeTruthy()); // the saved value (unchanged here) takes over
  });

  it('R50 a new saved value from outside replaces the readout when nothing is being dragged', () => {
    const onCommit = vi.fn();
    const { rerender } = render(<CommitSlider label="Metal of Brick" value={0.1} onCommit={onCommit} />);
    rerender(<CommitSlider label="Metal of Brick" value={0.7} onCommit={onCommit} />);
    expect(screen.getByText('0.70')).toBeTruthy();
  });

  it('preview R61 the Reset arrow commits the default once and is disabled while the saved value is the default', () => {
    const onCommit = vi.fn();
    const { rerender } = render(<CommitSlider label="Occlusion" value={0.7} onCommit={onCommit} resetTo={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Occlusion' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(1);
    rerender(<CommitSlider label="Occlusion" value={1} onCommit={onCommit} resetTo={1} />);
    expect((screen.getByRole('button', { name: 'Reset Occlusion' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R50 a disabled slider cannot be changed', () => {
    const { input } = setup(0.2, true);
    expect(input.disabled).toBe(true);
  });
});
