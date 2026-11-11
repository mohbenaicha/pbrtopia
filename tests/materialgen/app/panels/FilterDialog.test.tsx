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
