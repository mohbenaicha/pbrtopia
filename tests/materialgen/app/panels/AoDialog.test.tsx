// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultAoValues, readAoSettings, type AoSettings, type EditValues, type OpSession } from '@mat/imageops';
import type { MapRecord, MapsController } from '@mat/maps';
import { AoDialog } from '@mat/app/panels/AoDialog';
import { encodePng, type PixelImage } from '../../../../src/materialgen/maps/png/pngCodec';

vi.mock('@mat/imageops/ui/pixelPictureUrl', () => ({ pixelsToPictureUrl: vi.fn(async () => 'blob:preview') }));

const picture: PixelImage = { width: 8, height: 8, channels: 1, data: new Uint8Array(64).fill(90) };
const result: PixelImage = { width: 8, height: 8, channels: 1, data: new Uint8Array(64).fill(200) };
const record = (key: string): MapRecord => ({ originalKey: key, workingKey: key, undoKey: null, width: 8, height: 8 }) as unknown as MapRecord;
const readBlob = async (): Promise<Blob | null> => new Blob([encodePng(picture) as BlobPart], { type: 'image/png' });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:picture');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const fakeSession = (): OpSession<EditValues> & { close: ReturnType<typeof vi.fn> } =>
  ({ size: 8, previewSize: 8, renderPreview: vi.fn(async () => result), renderFinal: vi.fn(async () => result), close: vi.fn() }) as never;

function show(maps: { height?: MapRecord; normal?: MapRecord; ao?: MapRecord }, settings: AoSettings = readAoSettings(undefined), applied = true) {
  const session = fakeSession();
  const controller = { applyEdits: vi.fn(async () => applied) } as unknown as MapsController & { applyEdits: ReturnType<typeof vi.fn> };
  const openSession = vi.fn(async () => session);
  const onSettingsUsed = vi.fn();
  const onClose = vi.fn();
  render(<AoDialog maps={maps} settings={settings} colorMode="albedo" controller={controller} readBlob={readBlob} openSession={openSession} onSettingsUsed={onSettingsUsed} onClose={onClose} />);
  return { session, controller, openSession, onSettingsUsed, onClose };
}

const generate = (): HTMLButtonElement => screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement;

describe('materialgen/app AoDialog', () => {
  it('R42 with both a height and a normal map the source toggle shows, Height chosen', async () => {
    const { openSession } = show({ height: record('h1'), normal: record('n1') });
    expect(screen.getByRole('radio', { name: 'Height' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeTruthy();
    await waitFor(() => expect(openSession).toHaveBeenCalledWith(expect.anything(), 'height'));
  });

  it('R42 with only one source the toggle is not shown and that source is used', async () => {
    const { openSession } = show({ normal: record('n1') });
    expect(screen.queryByRole('radio', { name: 'Height' })).toBeNull();
    await waitFor(() => expect(openSession).toHaveBeenCalledWith(expect.anything(), 'normal'));
  });

  it('R42 the source used last time is chosen again when both exist', async () => {
    const { openSession } = show({ height: record('h1'), normal: record('n1') }, readAoSettings({ source: 'normal' }));
    await waitFor(() => expect(openSession).toHaveBeenCalledWith(expect.anything(), 'normal'));
  });

  it('R42 choosing Normal ends the session on the height map and opens one on the normal map', async () => {
    const { openSession, session } = show({ height: record('h1'), normal: record('n1') });
    await waitFor(() => expect(openSession).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('radio', { name: 'Normal' }));
    await waitFor(() => expect(openSession).toHaveBeenLastCalledWith(expect.anything(), 'normal'));
    await waitFor(() => expect(session.close).toHaveBeenCalledTimes(1));
  });

  it('R43 the controls start at the remembered parameters, and the first preview is drawn before any control moves', async () => {
    const { session } = show({ height: record('h1') }, readAoSettings({ height: { depth: 5 } }));
    await waitFor(() => expect(session.renderPreview).toHaveBeenCalled());
    expect(session.renderPreview).toHaveBeenCalledWith({ ...createDefaultAoValues('height'), depth: 5 });
    expect((screen.getByRole('spinbutton', { name: 'Depth value' }) as HTMLInputElement).value).toBe('5');
  });

  it('R43 Generate can be pressed with every parameter at its default', async () => {
    show({ height: record('h1') });
    await waitFor(() => expect(generate().disabled).toBe(false));
  });

  it('R43 Generate commits one edit of the AO map derived from the source working key, remembers the parameters and closes', async () => {
    const { controller, onSettingsUsed, onClose, session } = show({ height: record('h2') });
    await waitFor(() => expect(generate().disabled).toBe(false));
    fireEvent.change(screen.getByRole('slider', { name: 'Depth' }), { target: { value: '4' } });
    fireEvent.click(generate());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(session.renderFinal).toHaveBeenCalledWith({ ...createDefaultAoValues('height'), depth: 4 });
    expect(controller.applyEdits).toHaveBeenCalledWith([{ kind: 'ao', image: result, derivedFrom: { kind: 'height', key: 'h2' } }], 'Generate AO', false);
    expect(onSettingsUsed).toHaveBeenCalledWith('height', { ...createDefaultAoValues('height'), depth: 4 });
  });

  it('R43 Reset returns the parameters to the defaults, not to the remembered ones', async () => {
    show({ height: record('h1') }, readAoSettings({ height: { depth: 5 } }));
    await waitFor(() => expect(generate().disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect((screen.getByRole('spinbutton', { name: 'Depth value' }) as HTMLInputElement).value).toBe(String(createDefaultAoValues('height')['depth']));
  });

  it('R12 a commit that fails keeps the dialog and the parameters, and remembers nothing', async () => {
    const { onClose, onSettingsUsed } = show({ height: record('h1') }, readAoSettings(undefined), false);
    await waitFor(() => expect(generate().disabled).toBe(false));
    fireEvent.click(generate());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Could not save the result. Nothing changed.'));
    expect(onClose).not.toHaveBeenCalled();
    expect(onSettingsUsed).not.toHaveBeenCalled();
  });

  it('R43 with neither height nor normal there is nothing to open', () => {
    const { openSession } = show({});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(openSession).not.toHaveBeenCalled();
  });
});
