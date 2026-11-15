// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PixelImage } from '@mat/imageops';
import { EmissiveDialog } from '@mat/app/panels/export/EmissiveDialog';
import { encodePng } from '../../../../../src/materialgen/maps/png/pngCodec';

// Export R37-R40, R44: the map is 8 x 8; component 0 (Wall) is the left four columns and component 1 (Trim) the right four.
const albedo: PixelImage = { width: 8, height: 8, channels: 3, data: new Uint8Array(8 * 8 * 3).fill(90) };
const labels: PixelImage = { width: 8, height: 8, channels: 1, data: Uint8Array.from({ length: 64 }, (_, index) => (index % 8 < 4 ? 0 : 1)) };
const maskRow = (label: number, name: string) => ({ label, name, description: '', location: '', defaultMaterial: 'Brick', top3: ['Brick'], matchKind: 'keyword', material: 'Brick', rough: 0.8, metal: 0, height: 0 });
const record = (feather: number) => ({ source: 'model', feather, palette: [{ label: 0, hex: '#FF0000', name: 'red' }, { label: 1, hex: '#00FF00', name: 'green' }], rows: [maskRow(0, 'Wall'), maskRow(1, 'Trim')] });
const readBlob = async (key: string): Promise<Blob | null> => new Blob([encodePng(key === 'labels1' ? labels : albedo) as BlobPart], { type: 'image/png' });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:picture');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

function show(feather = 0) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<EmissiveDialog albedoKey="a1" labelsKey="labels1" masksRecord={record(feather) as never} size={8} readBlob={readBlob} onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel };
}
const swatch = (name: string): HTMLElement => screen.getByRole('button', { name });
const confirmButton = (): HTMLButtonElement => screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement;
const ready = async (): Promise<void> => void (await waitFor(() => expect(swatch('Wall')).toBeTruthy()));
const confirmedPlane = (onConfirm: ReturnType<typeof vi.fn>): PixelImage => onConfirm.mock.calls[0]![0] as PixelImage;
const row = (plane: PixelImage, y = 0): number[] => Array.from(plane.data.slice(y * 8, y * 8 + 8));

describe('materialgen/export R38 the emissive dialog', () => {
  it('R38 shows one picture, the swatches with their hint, a Softness slider, Reset, Cancel and Confirm', async () => {
    show();
    await ready();
    expect(screen.getByRole('dialog', { name: 'Emissive map' })).toBeTruthy();
    expect(screen.getByText('Select the materials that glow')).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Softness' })).toBeTruthy();
    for (const name of ['Reset', 'Cancel', 'Confirm']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.queryByRole('slider', { name: 'Comparison divider' })).toBeNull(); // one picture, no reveal
  });

  it('R38 Confirm is disabled until a swatch is selected; several can be selected; Reset clears them', async () => {
    show();
    await ready();
    expect(confirmButton().disabled).toBe(true);
    fireEvent.click(swatch('Wall'));
    fireEvent.click(swatch('Trim'));
    expect(confirmButton().disabled).toBe(false);
    expect(swatch('Trim').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(swatch('Wall').getAttribute('aria-pressed')).toBe('false');
    expect(confirmButton().disabled).toBe(true);
  });

  it('R38 Cancel and Escape call onCancel and never onConfirm', async () => {
    const { onConfirm, onCancel } = show();
    await ready();
    fireEvent.click(swatch('Wall'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('R38 a click outside the dialog does nothing', async () => {
    const { onCancel } = show();
    await ready();
    fireEvent.pointerDown(document.body);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('R44 the dialog is drawn on the stacked layer', async () => {
    show();
    await ready();
    expect(screen.getByRole('dialog').parentElement?.hasAttribute('data-stacked')).toBe(true);
  });
});

describe('materialgen/export R39 the overlay', () => {
  it('R39 the overlay appears with a selection and is gone without one', async () => {
    show();
    await ready();
    expect(screen.queryByTestId('compare-overlay')).toBeNull();
    fireEvent.click(swatch('Wall'));
    expect(screen.getByTestId('compare-overlay')).toBeTruthy();
    fireEvent.click(swatch('Wall'));
    expect(screen.queryByTestId('compare-overlay')).toBeNull();
  });
});

describe('materialgen/export R40 the plane and Softness', () => {
  it('R40 Confirm bakes 255 on the selected component and 0 elsewhere, one grey channel at S', async () => {
    const { onConfirm } = show();
    await ready();
    fireEvent.click(swatch('Wall'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const plane = confirmedPlane(onConfirm);
    expect([plane.width, plane.height, plane.channels]).toEqual([8, 8, 1]);
    expect(row(plane)).toEqual([255, 255, 255, 255, 0, 0, 0, 0]);
    expect(row(plane, 7)).toEqual([255, 255, 255, 255, 0, 0, 0, 0]);
  });

  it('R40 Confirm shows its loading state first, locks Reset, Cancel and Escape while it bakes, then confirms once', async () => {
    const { onConfirm, onCancel } = show();
    await ready();
    fireEvent.click(swatch('Wall'));
    fireEvent.click(confirmButton());
    expect(confirmButton().getAttribute('aria-busy')).toBe('true');
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it('R40 a teardown while Confirm is loading bakes nothing and calls nothing', async () => {
    const { onConfirm } = show();
    await ready();
    fireEvent.click(swatch('Wall'));
    fireEvent.click(confirmButton());
    cleanup(); // the dialog goes away in that frame
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('R40 the project Feather is not used: Softness 0 stays crisp whatever the masks record says', async () => {
    const { onConfirm } = show(3);
    await ready();
    fireEvent.click(swatch('Trim'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(row(confirmedPlane(onConfirm))).toEqual([0, 0, 0, 0, 255, 255, 255, 255]);
  });

  it('R40 Softness runs 0 to 50 pixels in whole steps from 0, and softens the edge once it is released', async () => {
    const { onConfirm } = show();
    await ready();
    const slider = screen.getByRole('slider', { name: 'Softness' }) as HTMLInputElement;
    expect([slider.min, slider.max, slider.step, slider.value]).toEqual(['0', '50', '1', '0']);
    fireEvent.click(swatch('Wall'));
    fireEvent.change(slider, { target: { value: '1' } });
    fireEvent.keyUp(slider); // the release
    fireEvent.click(confirmButton());
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const edge = row(confirmedPlane(onConfirm));
    expect(edge[1]).toBe(255);
    expect(edge[3]).toBeGreaterThan(0);
    expect(edge[3]).toBeLessThan(255);
  });

  it('R40 Reset puts Softness back to 0', async () => {
    show();
    await ready();
    const slider = screen.getByRole('slider', { name: 'Softness' }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '2' } });
    fireEvent.keyUp(slider);
    await waitFor(() => expect((screen.getByRole('slider', { name: 'Softness' }) as HTMLInputElement).value).toBe('2')); // saved on release
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect((screen.getByRole('slider', { name: 'Softness' }) as HTMLInputElement).value).toBe('0'));
  });
});
