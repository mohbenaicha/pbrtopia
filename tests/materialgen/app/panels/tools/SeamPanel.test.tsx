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

function show(readEdgeSource = vi.fn(async (): Promise<PixelImage | null> => picture(100)), onApply = vi.fn(async () => ({ ok: true }) as { ok: boolean; message?: string }), tiling = { x: 1, y: 1 }) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  const onTilingChange = vi.fn();
  render(<SeamPanel onChange={onChange} readEdgeSource={readEdgeSource} onApply={onApply} onClose={onClose} tiling={tiling} onTilingChange={onTilingChange} />);
  return { onChange, onClose, onApply, readEdgeSource, onTilingChange };
}
const tilingX = (): HTMLInputElement => screen.getByRole('slider', { name: 'X' }) as HTMLInputElement;
const tilingY = (): HTMLInputElement => screen.getByRole('slider', { name: 'Y' }) as HTMLInputElement;
const apply = (): HTMLButtonElement => screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement;
const canny = (): HTMLInputElement => screen.getByRole('switch', { name: 'Canny edges' }) as HTMLInputElement;
const fade = (): HTMLInputElement => screen.getByRole('slider', { name: 'Fade start' }) as HTMLInputElement;

describe('materialgen/app SeamPanel', () => {
  it('R63 it is a panel with a Fade start slider, a Canny edges switch and the Tiling preview section but no readout, and the viewport is told the defaults when it opens', () => {
    const { onChange } = show();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fade().value).toBe('55');
    expect(canny().checked).toBe(false);
    expect(screen.queryByText(/^Fade .* of the side/)).toBeNull();
    expect(document.querySelector('.tool-panel__readout')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Tiling preview' })).toBeTruthy();
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

  it('R65 moving the slider reports the new depth at once', () => {
    const { onChange } = show();
    fireEvent.change(fade(), { target: { value: '80' } });
    expect(onChange).toHaveBeenLastCalledWith({ depth: 0.1, profile: null });
  });

  it('R77 while the pointer is held on the slider the viewport is told nothing; the release reports the last depth once', () => {
    const { onChange } = show();
    onChange.mockClear();
    const row = fade().closest('.ui-slider') as HTMLElement;
    fireEvent.pointerDown(row);
    fireEvent.change(fade(), { target: { value: '80' } });
    fireEvent.change(fade(), { target: { value: '90' } });
    expect(fade().value).toBe('90'); // the slider follows the pointer
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

describe('materialgen/imageops R88 the Tiling preview section', () => {
  it('R88 X and Y are rows like Fade start (label, track, number, reset arrow) showing the project tiling, from 1 to 10 in whole steps', () => {
    show(undefined, undefined, { x: 3, y: 2 });
    expect([tilingX().value, tilingY().value]).toEqual(['3', '2']);
    expect([tilingX().min, tilingX().max, tilingX().step]).toEqual(['1', '10', '1']);
    expect(tilingX().closest('.ui-slider')?.getAttribute('data-layout')).toBe('row');
    expect(screen.getByRole('spinbutton', { name: 'X value' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset X' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset Y' })).toBeTruthy();
  });

  it('R88 the sliders sit after Canny edges, under the heading', () => {
    show();
    const heading = screen.getByRole('heading', { name: 'Tiling preview' });
    expect(canny().compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heading.compareDocumentPosition(tilingX()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tilingX().compareDocumentPosition(tilingY()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('R88 a change goes to the owner at once, one axis at a time, with no pointer hold', () => {
    const { onTilingChange } = show();
    fireEvent.change(tilingX(), { target: { value: '4' } });
    expect(onTilingChange).toHaveBeenLastCalledWith({ tilingX: 4 });
    fireEvent.change(tilingY(), { target: { value: '2' } });
    expect(onTilingChange).toHaveBeenLastCalledWith({ tilingY: 2 });
  });

  it('R88 the reset arrows put an axis back to 1', () => {
    const { onTilingChange } = show(undefined, undefined, { x: 5, y: 5 });
    fireEvent.click(screen.getByRole('button', { name: 'Reset X' }));
    expect(onTilingChange).toHaveBeenLastCalledWith({ tilingX: 1 });
  });

  it('R88 the panel Reset leaves the tiling alone, and tiling never reaches Apply or the viewport transform', async () => {
    const { onTilingChange, onChange, onApply } = show(undefined, undefined, { x: 3, y: 3 });
    onChange.mockClear();
    fireEvent.change(fade(), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onTilingChange).not.toHaveBeenCalled();
    expect(tilingX().value).toBe('3');
    fireEvent.click(apply());
    await waitFor(() => expect(onApply).toHaveBeenCalledWith({ depth: 0.225, profile: null }));
  });
});
