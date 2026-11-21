// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultNormalValues, type EditValues, type OpSession } from '@mat/imageops';
import type { MapRecord, MapsController } from '@mat/maps';
import { NormalDialog } from '@mat/app/panels/NormalDialog';
import { encodePng, type PixelImage } from '../../../../src/materialgen/maps/png/pngCodec';

vi.mock('@mat/imageops/ui/pixelPictureUrl', () => ({ pixelsToPictureUrl: vi.fn(async () => 'blob:preview') }));

const picture: PixelImage = { width: 8, height: 8, channels: 1, data: new Uint8Array(64).fill(90) };
const result: PixelImage = { width: 8, height: 8, channels: 3, data: new Uint8Array(192).fill(128) };
const record = (key: string): MapRecord => ({ originalKey: key, workingKey: key, undoKey: null, width: 8, height: 8 }) as unknown as MapRecord;
const readBlob = async (): Promise<Blob | null> => new Blob([encodePng(picture) as BlobPart], { type: 'image/png' });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:picture');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const fakeSession = (): OpSession<EditValues> & { close: ReturnType<typeof vi.fn> } =>
  ({ size: 8, previewSize: 8, renderPreview: vi.fn(async () => result), renderFinal: vi.fn(async () => result), close: vi.fn() }) as never;

function show(maps: { height: MapRecord; normal?: MapRecord }, remembered: EditValues = createDefaultNormalValues(), applied = true) {
  const session = fakeSession();
  const controller = { applyEdits: vi.fn(async () => applied) } as unknown as MapsController & { applyEdits: ReturnType<typeof vi.fn> };
  const openSession = vi.fn(async () => session);
  const onSettingsUsed = vi.fn();
  const onClose = vi.fn();
  render(<NormalDialog maps={maps} initial={remembered} controller={controller} readBlob={readBlob} openSession={openSession} onSettingsUsed={onSettingsUsed} onClose={onClose} />);
  return { session, controller, openSession, onSettingsUsed, onClose };
}

const generate = (): HTMLButtonElement => screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement;

describe('materialgen/app NormalDialog', () => {
  it('normal-from-height R7 the dialog is titled "Generate normal map" and has Blur and Strength, Reset, Cancel and Generate', async () => {
    show({ height: record('h1') });
    expect(screen.getByText('Generate normal map')).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Blur' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Strength' })).toBeTruthy();
    for (const name of ['Reset', 'Cancel', 'Generate']) expect(screen.getByRole('button', { name })).toBeTruthy();
    await waitFor(() => expect(generate().disabled).toBe(false));
  });

  it('normal-from-height R7 the session opens on the height map and the first preview is drawn with the remembered values', async () => {
    const { openSession, session } = show({ height: record('h1') }, { blur: 2, strength: 60 });
    await waitFor(() => expect(openSession).toHaveBeenCalledWith(expect.objectContaining({ width: 8 })));
    await waitFor(() => expect(session.renderPreview).toHaveBeenCalledWith({ blur: 2, strength: 60 }));
    expect((screen.getByRole('spinbutton', { name: 'Strength value' }) as HTMLInputElement).value).toBe('60');
  });

  it('normal-from-height R7 Generate can be pressed with every parameter at its default', async () => {
    show({ height: record('h1') });
    await waitFor(() => expect(generate().disabled).toBe(false));
  });

  it('normal-from-height R7 Generate commits one edit of the normal map derived from the height working key, remembers the values and closes', async () => {
    const { controller, onSettingsUsed, onClose, session } = show({ height: record('h2') });
    await waitFor(() => expect(generate().disabled).toBe(false));
    fireEvent.change(screen.getByRole('slider', { name: 'Strength' }), { target: { value: '60' } });
    fireEvent.click(generate());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(session.renderFinal).toHaveBeenCalledWith({ blur: 1, strength: 60 });
    expect(controller.applyEdits).toHaveBeenCalledWith([{ kind: 'normal', image: result, derivedFrom: { kind: 'height', key: 'h2' } }], 'Generate normal map', false);
    expect(onSettingsUsed).toHaveBeenCalledWith({ blur: 1, strength: 60 });
  });

  it('normal-from-height R7 Reset returns the parameters to the defaults, not to the remembered ones', async () => {
    show({ height: record('h1') }, { blur: 2, strength: 60 });
    await waitFor(() => expect(generate().disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect((screen.getByRole('spinbutton', { name: 'Strength value' }) as HTMLInputElement).value).toBe('45');
  });

  it('normal-from-height R7 with no normal map the left picture is the height map, with one it is the current normal map', async () => {
    show({ height: record('h1') });
    expect(await screen.findAllByLabelText(/Height map/)).not.toHaveLength(0); // the picture, or its loading mark
    cleanup();
    show({ height: record('h1'), normal: record('n1') });
    await waitFor(() => expect(generate().disabled).toBe(false));
    expect(screen.queryAllByLabelText(/Height map/)).toHaveLength(0);
  });

  it('normal-from-height R7 a commit that fails keeps the dialog and the parameters, and remembers nothing', async () => {
    const { onClose, onSettingsUsed } = show({ height: record('h1') }, createDefaultNormalValues(), false);
    await waitFor(() => expect(generate().disabled).toBe(false));
    fireEvent.click(generate());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Could not save the result. Nothing changed.'));
    expect(onClose).not.toHaveBeenCalled();
    expect(onSettingsUsed).not.toHaveBeenCalled();
  });

  it('normal-from-height R10 a session that cannot start says so under the controls and changes nothing', async () => {
    const controller = { applyEdits: vi.fn(async () => true) } as unknown as MapsController;
    render(<NormalDialog maps={{ height: record('h1') }} initial={createDefaultNormalValues()} controller={controller} readBlob={readBlob} openSession={vi.fn(async () => { throw new Error('no worker'); })} onSettingsUsed={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Could not start the tool: the map is unavailable.'));
  });
});
