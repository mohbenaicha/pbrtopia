// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FilterSession } from '@mat/imageops';
import type { MapRecord, MapsController } from '@mat/maps';
import { FilterDialog } from '@mat/app/panels/FilterDialog';
import { encodePng, type PixelImage } from '../../../../src/materialgen/maps/png/pngCodec';

vi.mock('@mat/imageops/ui/pixelPictureUrl', () => ({ pixelsToPictureUrl: vi.fn(async () => 'blob:preview') }));

const picture: PixelImage = { width: 8, height: 8, channels: 3, data: new Uint8Array(8 * 8 * 3).fill(90) };
const result: PixelImage = { width: 8, height: 8, channels: 3, data: new Uint8Array(8 * 8 * 3).fill(200) };
const map = { originalKey: 'a1', workingKey: 'a1', undoKey: null, width: 8, height: 8 } as unknown as MapRecord;
const readBlob = async (): Promise<Blob | null> => new Blob([encodePng(picture) as BlobPart], { type: 'image/png' });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:picture');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

function fakeSession(patch: Partial<FilterSession> = {}): FilterSession & { close: ReturnType<typeof vi.fn> } {
  return { size: 8, previewSize: 8, renderPreview: vi.fn(async () => result), renderFinal: vi.fn(async () => result), close: vi.fn(), ...patch } as FilterSession & { close: ReturnType<typeof vi.fn> };
}

function show(session: FilterSession, applied = true) {
  const controller = { applyEdits: vi.fn(async () => applied) } as unknown as MapsController & { applyEdits: ReturnType<typeof vi.fn> };
  const openSession = vi.fn(async () => session);
  const onClose = vi.fn();
  const view = render(<FilterDialog kind="albedo" map={map} colorMode="albedo" controller={controller} readBlob={readBlob} openSession={openSession} onClose={onClose} />);
  return { controller, openSession, onClose, ...view };
}

const moveExposure = async (): Promise<void> => {
  await waitFor(() => expect(screen.getByRole('slider', { name: 'Exposure' })).toBeTruthy());
  fireEvent.change(screen.getByRole('slider', { name: 'Exposure' }), { target: { value: '1' } });
};
const applyButton = (): HTMLButtonElement => screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement;

// Imageops R78-R81: the map is 8 x 8; the labels have component 0 (Wall) on the left four columns and component 1 (Trim) on the right four.
const labelsPicture: PixelImage = { width: 8, height: 8, channels: 1, data: Uint8Array.from({ length: 64 }, (_, index) => (index % 8 < 4 ? 0 : 1)) };
const maskRow = (label: number, name: string) => ({ label, name, description: '', location: '', defaultMaterial: 'Brick', top3: ['Brick'], matchKind: 'keyword', material: 'Brick', rough: 0.8, metal: 0, height: 0 });
const masksRecord = { source: 'model', feather: 0, palette: [{ label: 0, hex: '#FF0000', name: 'red' }, { label: 1, hex: '#00FF00', name: 'green' }], rows: [maskRow(0, 'Wall'), maskRow(1, 'Trim')] };
const scopedBlob = async (key: string): Promise<Blob | null> => new Blob([encodePng(key === 'labels1' ? labelsPicture : picture) as BlobPart], { type: 'image/png' });

function showScoped(record: unknown = masksRecord, labelsKey: string | null = 'labels1') {
  const session = fakeSession();
  const controller = { applyEdits: vi.fn(async () => true) } as unknown as MapsController & { applyEdits: ReturnType<typeof vi.fn> };
  const view = render(<FilterDialog kind="albedo" map={map} colorMode="albedo" controller={controller} readBlob={scopedBlob} openSession={vi.fn(async () => session)} onClose={vi.fn()} masksRecord={record as never} labelsKey={labelsKey} />);
  return { session, controller, ...view };
}
const swatchOf = (name: string): HTMLElement => screen.getByRole('button', { name });

describe('materialgen/app FilterDialog mask scope (imageops R78-R81)', () => {
  it('R78 with masks the swatches and their hint are at the top of the controls; without masks, or with labels of another size, there are none', async () => {
    showScoped();
    await waitFor(() => expect(swatchOf('Wall')).toBeTruthy());
    expect(swatchOf('Trim').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Edit only the selected masks')).toBeTruthy();
    cleanup();
    showScoped(null); // the project has no masks
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Exposure' })).toBeTruthy());
    expect(screen.queryByText('Edit only the selected masks')).toBeNull();
    cleanup();
    showScoped(masksRecord, null);
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Exposure' })).toBeTruthy());
    expect(screen.queryByText('Edit only the selected masks')).toBeNull();
  });

  it('R78 swatches toggle, several can be selected, and the selection alone does not enable Apply', async () => {
    showScoped();
    await waitFor(() => expect(swatchOf('Wall')).toBeTruthy());
    fireEvent.click(swatchOf('Wall'));
    fireEvent.click(swatchOf('Trim'));
    expect(swatchOf('Wall').getAttribute('aria-pressed')).toBe('true');
    expect(swatchOf('Trim').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(swatchOf('Trim'));
    expect(swatchOf('Trim').getAttribute('aria-pressed')).toBe('false');
    expect(applyButton().disabled).toBe(true);
  });

  it('R79 Apply with Wall selected commits the filtered pixels on Wall and the original bytes elsewhere', async () => {
    const { controller } = showScoped();
    await waitFor(() => expect(swatchOf('Wall')).toBeTruthy());
    fireEvent.click(swatchOf('Wall'));
    await moveExposure();
    fireEvent.click(applyButton());
    await waitFor(() => expect(controller.applyEdits).toHaveBeenCalledTimes(1));
    const [[edit]] = controller.applyEdits.mock.calls[0] as [Array<{ image: PixelImage }>];
    expect(edit!.image.data[0]).toBe(200); // red channel, x = 0: inside Wall
    expect(edit!.image.data[(0 * 8 + 5) * 3]).toBe(90); // x = 5: inside Trim, the original byte
    expect(edit!.image.data[(7 * 8 + 7) * 3 + 2]).toBe(90);
  });

  it('R79 with nothing selected Apply commits the whole filtered picture, as before', async () => {
    const { controller } = showScoped();
    await waitFor(() => expect(swatchOf('Wall')).toBeTruthy());
    await moveExposure();
    fireEvent.click(applyButton());
    await waitFor(() => expect(controller.applyEdits).toHaveBeenCalledTimes(1));
    const [[edit]] = controller.applyEdits.mock.calls[0] as [Array<{ image: PixelImage }>];
    expect(Array.from(new Set(edit!.image.data))).toEqual([200]);
  });

  it('R79 the preview is blended too, and a change of the selection draws it again', async () => {
    const { pixelsToPictureUrl } = await import('@mat/imageops/ui/pixelPictureUrl');
    const shown = vi.mocked(pixelsToPictureUrl);
    shown.mockClear();
    const { session } = showScoped();
    await waitFor(() => expect(swatchOf('Wall')).toBeTruthy());
    await moveExposure();
    await waitFor(() => expect(session.renderPreview).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((shown.mock.calls.at(-1)![0] as PixelImage).data[0]).toBe(200)); // no selection: all filtered
    fireEvent.click(swatchOf('Trim')); // Trim is the right half: the left stays the original
    await waitFor(() => expect(session.renderPreview).toHaveBeenCalledTimes(2));
    await waitFor(() => expect((shown.mock.calls.at(-1)![0] as PixelImage).data[0]).toBe(90));
    expect((shown.mock.calls.at(-1)![0] as PixelImage).data[5 * 3]).toBe(200);
  });

  it('R80 hovering a swatch draws one overlay over the stage and leaving removes it', async () => {
    vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
    const putImageData = vi.fn();
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ putImageData } as never);
    showScoped();
    await waitFor(() => expect(swatchOf('Wall')).toBeTruthy());
    expect(screen.queryByTestId('compare-overlay')).toBeNull();
    fireEvent.pointerEnter(swatchOf('Wall'));
    await waitFor(() => expect(screen.getByTestId('compare-overlay')).toBeTruthy());
    const painted = (putImageData.mock.calls.at(-1)![0] as ImageData).data;
    expect(Array.from(painted.slice(0, 4))).toEqual([255, 0, 0, 191]); // Wall's colour at 0.75, at x = 0
    expect(Array.from(painted.slice(5 * 4, 5 * 4 + 4))).toEqual([0, 0, 0, 0]); // x = 5 is Trim
    fireEvent.pointerLeave(swatchOf('Wall'));
    expect(screen.queryByTestId('compare-overlay')).toBeNull();
    getContext.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('materialgen/app FilterDialog colour mixin (imageops R82, R84)', () => {
  const albedoPicture: PixelImage = { width: 4, height: 4, channels: 3, data: new Uint8Array(4 * 4 * 3).fill(60) };
  const mixBlob = async (key: string): Promise<Blob | null> => new Blob([encodePng(key === 'albedo1' ? albedoPicture : picture) as BlobPart], { type: 'image/png' });
  const showNormal = (albedoKey: string | null) => {
    const openSession = vi.fn(async () => fakeSession());
    const controller = { applyEdits: vi.fn(async () => true) } as unknown as MapsController;
    render(<FilterDialog kind="normal" map={map} colorMode="albedo" controller={controller} readBlob={mixBlob} openSession={openSession} onClose={vi.fn()} albedoKey={albedoKey} />);
    return openSession;
  };

  it('R82 a normal map offers the Colour mixin when the project has an albedo, and not without one', async () => {
    showNormal('albedo1');
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Colour mixin' })).toBeTruthy());
    cleanup();
    showNormal(null);
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Denoise' })).toBeTruthy());
    expect(screen.queryByRole('slider', { name: 'Colour mixin' })).toBeNull();
  });

  it('R84 the albedo is read once and handed to the session with the normal map; without an albedo the session gets none', async () => {
    const withAlbedo = showNormal('albedo1');
    await waitFor(() => expect(withAlbedo).toHaveBeenCalledTimes(1));
    const [, kind, albedo] = withAlbedo.mock.calls[0] as unknown as [PixelImage, string, PixelImage | undefined];
    expect(kind).toBe('normal');
    expect(albedo?.width).toBe(4);
    cleanup();
    const without = showNormal(null);
    await waitFor(() => expect(without).toHaveBeenCalledTimes(1));
    expect(without.mock.calls[0]).toHaveLength(2);
  });
});

describe('materialgen/app FilterDialog', () => {
  it('R9 R17 opens one session on the working copy of the map and names the map in its title', async () => {
    const { openSession } = show(fakeSession());
    expect(screen.getByRole('dialog', { name: 'Filter Albedo' })).toBeTruthy();
    await waitFor(() => expect(openSession).toHaveBeenCalledTimes(1));
    const [pixels, kind] = openSession.mock.calls[0] as unknown as [PixelImage, string];
    expect(kind).toBe('albedo');
    expect(pixels.width).toBe(8);
  });

  it('R16 Apply stays disabled until a control leaves its default', async () => {
    show(fakeSession());
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Exposure' })).toBeTruthy());
    expect(applyButton().disabled).toBe(true);
    await moveExposure();
    await waitFor(() => expect(applyButton().disabled).toBe(false));
  });

  it('R19 R11 Apply renders at S, commits one single-map edit labelled Filter and closes the dialog', async () => {
    const session = fakeSession();
    const { controller, onClose } = show(session);
    await moveExposure();
    await waitFor(() => expect(applyButton().disabled).toBe(false));
    fireEvent.click(applyButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(session.renderFinal).toHaveBeenCalledWith(expect.objectContaining({ exposure: 1 }));
    expect(controller.applyEdits).toHaveBeenCalledWith([{ kind: 'albedo', image: result }], 'Filter', false);
  });

  it('R12 a render error on Apply keeps the dialog open, commits nothing and says nothing changed', async () => {
    const session = fakeSession({ renderFinal: vi.fn(async () => { throw new Error('lost'); }) });
    const { controller, onClose } = show(session);
    await moveExposure();
    await waitFor(() => expect(applyButton().disabled).toBe(false));
    fireEvent.click(applyButton());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Could not apply (graphics error). Nothing changed.'));
    expect(controller.applyEdits).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('R29 a commit that fails keeps the dialog open so the settings are not lost', async () => {
    const { controller, onClose } = show(fakeSession(), false);
    await moveExposure();
    await waitFor(() => expect(applyButton().disabled).toBe(false));
    fireEvent.click(applyButton());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Could not save the result. Nothing changed.'));
    expect(controller.applyEdits).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('R38 a press outside the dialog (the panels behind it) does not cancel it; Escape does', async () => {
    const { onClose } = show(fakeSession());
    await moveExposure();
    fireEvent.pointerDown(document.body);
    fireEvent.pointerDown(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByRole('slider', { name: 'Exposure' }) as HTMLInputElement).value).toBe('1');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('R17 Cancel closes the dialog and gives the session back without committing', async () => {
    const session = fakeSession();
    const { controller, onClose, unmount } = show(session);
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Exposure' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    await waitFor(() => expect(session.close).toHaveBeenCalledTimes(1));
    expect(controller.applyEdits).not.toHaveBeenCalled();
  });

  it('R50 the reveal shows Before beside After once the session is open, with no internal names', async () => {
    show(fakeSession());
    await waitFor(() => expect(screen.getByAltText('After')).toBeTruthy());
    expect(screen.getByAltText('Before')).toBeTruthy();
    expect(screen.queryByAltText('Working')).toBeNull();
    expect(screen.queryByAltText('Preview')).toBeNull();
  });

  it('R12 a map file that cannot be read says the edit cannot start', async () => {
    const controller = { applyEdits: vi.fn() } as unknown as MapsController;
    render(<FilterDialog kind="albedo" map={map} colorMode="albedo" controller={controller} readBlob={async () => null} openSession={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not start the edit'));
  });
});
