// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PixelImage } from '@mat/imageops';
import { SeamPanel } from '@mat/app/panels/tools/SeamPanel';

afterEach(cleanup);

const picture = (side: number): PixelImage => {
  const data = new Uint8Array(side * side);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) data[y * side + x] = x < 5 ? 40 : 100 + x;
  return { width: side, height: side, channels: 1, data };
};

function show(readEdgeSource = vi.fn(async (): Promise<PixelImage | null> => picture(100)), onApply = vi.fn(async () => ({ ok: true }) as { ok: boolean; message?: string })) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  render(<SeamPanel onChange={onChange} readEdgeSource={readEdgeSource} onApply={onApply} onClose={onClose} />);
  return { onChange, onClose, onApply, readEdgeSource };
}
const apply = (): HTMLButtonElement => screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement;
const canny = (): HTMLInputElement => screen.getByRole('switch', { name: 'Canny edges' }) as HTMLInputElement;
const fade = (): HTMLInputElement => screen.getByRole('slider', { name: 'Fade start' }) as HTMLInputElement;

describe('materialgen/app SeamPanel', () => {
  it('R63 it is a panel with a Fade start slider, a Canny edges checkbox and the readout, and the viewport is told the defaults when it opens', () => {
    const { onChange } = show();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fade().value).toBe('55');
    expect(canny().checked).toBe(false);
    expect(screen.getByText('Fade 22.5 % of the side')).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith({ depth: 0.225, profile: null });
  });

  it('R65 Canny edges is a switch on its own row: the label on the left, the switch on the right; Fade start is the row of label, track, number and reset', () => {
    show();
    expect(screen.queryByRole('checkbox')).toBeNull();
    const row = canny().closest('label')!;
    expect(row.className).toContain('ui-toggle');
    expect(row.firstElementChild?.textContent).toBe('Canny edges'); // the label comes first, the switch after it
    expect(row.contains(fade())).toBe(false);
    expect(fade().closest('.ui-slider')?.getAttribute('data-layout')).toBe('row');
    expect(screen.getByRole('spinbutton', { name: 'Fade start value' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset Fade start' })).toBeTruthy();
  });

  it('R65 the stylesheet keeps the Fade start row inside the panel: the track shrinks and the number and reset arrow stay', () => {
    const css = readFileSync(resolve(__dirname, '../../../../../src/materialgen/imageops/ui/opControls.css'), 'utf8');
    expect(css).toMatch(/\.tool-panel \.ui-slider\[data-layout='row'\][^}]*grid-template-columns: [^;]*minmax\(0, 1fr\) auto/s);
    expect(css).toMatch(/\.tool-panel[^{}]*input\[type='range'\][^}]*min-width: 0/s);
  });

  it('R65 moving the slider reports the new depth at once and changes the readout', () => {
    const { onChange } = show();
    fireEvent.change(fade(), { target: { value: '80' } });
    expect(onChange).toHaveBeenLastCalledWith({ depth: 0.1, profile: null });
    expect(screen.getByText('Fade 10 % of the side')).toBeTruthy();
  });

  it('R77 while the pointer is held on the slider the viewport is told nothing; the release reports the last depth once', () => {
    const { onChange } = show();
    onChange.mockClear();
    const row = fade().closest('.ui-slider') as HTMLElement;
    fireEvent.pointerDown(row);
    fireEvent.change(fade(), { target: { value: '80' } });
    fireEvent.change(fade(), { target: { value: '90' } });
    expect(screen.getByText('Fade 5 % of the side')).toBeTruthy(); // the readout follows the pointer
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(row);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ depth: 0.05, profile: null });
  });

  it('R77 a cancelled pointer also reports, and Apply uses the reported depth', async () => {
    const { onChange, onApply } = show();
    const row = fade().closest('.ui-slider') as HTMLElement;
    fireEvent.pointerDown(row);
    fireEvent.change(fade(), { target: { value: '80' } });
    fireEvent.pointerCancel(row);
    expect(onChange).toHaveBeenLastCalledWith({ depth: 0.1, profile: null });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith({ depth: 0.1, profile: null }));
  });

  it('R66 switching Canny on reads the map once, then reports a profile; the slider re-shapes it without reading again', async () => {
    const { onChange, readEdgeSource } = show();
    fireEvent.click(canny());
    await waitFor(() => expect(onChange.mock.calls.at(-1)![0].profile).toBeInstanceOf(Float32Array));
    expect(readEdgeSource).toHaveBeenCalledTimes(1);
    const first = onChange.mock.calls.at(-1)![0].profile as Float32Array;
    expect(first).toHaveLength(200);
    expect(screen.getByText('Fade up to 22.5 % of the side, ending at the first edge')).toBeTruthy();
    fireEvent.change(fade(), { target: { value: '80' } });
    fireEvent.click(canny()); // off
    fireEvent.click(canny()); // on again
    await waitFor(() => expect(onChange.mock.calls.at(-1)![0].profile).toBeInstanceOf(Float32Array));
    expect(readEdgeSource).toHaveBeenCalledTimes(1);
  });

  it('R66 while the map is being read the checkbox is busy and the preview keeps the fixed depth', async () => {
    let finish: (image: PixelImage) => void = () => undefined;
    const { onChange } = show(vi.fn(() => new Promise<PixelImage | null>((resolve) => { finish = resolve; })));
    fireEvent.click(canny());
    expect(canny().disabled).toBe(true);
    expect(onChange.mock.calls.at(-1)![0].profile).toBeNull();
    finish(picture(100));
    await waitFor(() => expect(canny().disabled).toBe(false));
    expect(onChange.mock.calls.at(-1)![0].profile).toBeInstanceOf(Float32Array);
  });

  it('R66 a map that cannot be read leaves Canny off and says so', async () => {
    show(vi.fn(async () => null));
    fireEvent.click(canny());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('cannot be read'));
    expect(canny().checked).toBe(false);
  });

  it('R68 Apply is enabled and hands over the depth and, with Canny on, the profile; a good Apply closes the panel', async () => {
    const { onApply, onClose } = show();
    expect(apply().disabled).toBe(false);
    fireEvent.click(apply());
    await waitFor(() => expect(onApply).toHaveBeenCalledWith({ depth: 0.225, profile: null }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('R63 Reset restores 55 % with Canny off, and Cancel closes', () => {
    const { onClose, onChange } = show();
    fireEvent.change(fade(), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(fade().value).toBe('55');
    expect(onChange).toHaveBeenLastCalledWith({ depth: 0.225, profile: null });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
