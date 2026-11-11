// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapCard } from '../../../../src/materialgen/maps/ui/MapCard';
import { buildCardModel } from '../../../../src/materialgen/maps/ui/buildCardModel';
import type { MapCardActions } from '../../../../src/materialgen/maps/ui/MapHalf';
import { editMaps, placeMap } from '../../../../src/materialgen/maps/mapOperations';
import type { MapsState } from '../../../../src/materialgen/maps';
import { encodePng, type PixelImage } from '../../../../src/materialgen/maps/png/pngCodec';

afterEach(cleanup);

const empty: MapsState = { size: null, maps: {} };
const put = (state: MapsState, kind: Parameters<typeof placeMap>[1], key: string, more: Partial<Parameters<typeof placeMap>[2]> = {}): MapsState =>
  placeMap(state, kind, { originalKey: key, workingKey: key, width: 1024, height: 1024, ...more });
const pixels: PixelImage = { width: 2, height: 2, channels: 3, data: new Uint8Array(12).fill(9) };
const blob = (): Blob => new Blob([encodePng(pixels) as BlobPart], { type: 'image/png' });

function actions(): MapCardActions & { [K in keyof MapCardActions]: ReturnType<typeof vi.fn> } {
  return { dropFiles: vi.fn(), undo: vi.fn(), restoreOriginal: vi.fn(), requestClear: vi.fn(), view: vi.fn(), filter: vi.fn(), download: vi.fn(), refuseDrop: vi.fn() } as never;
}

function show(state: MapsState, slot: Parameters<typeof buildCardModel>[1], patch: { canWrite?: boolean; busy?: string[]; opOpen?: boolean; readBlob?: (key: string) => Promise<Blob | null> } = {}) {
  const given = actions();
  const draw = vi.fn();
  const busy = new Set(patch.busy ?? []);
  render(
    <MapCard
      model={buildCardModel(state, slot, 'albedo')}
      canWrite={patch.canWrite ?? true}
      opOpen={patch.opOpen ?? false}
      readOnlyReason="Open in another tab"
      isBusy={(kind) => busy.has(kind)}
      readBlob={patch.readBlob ?? (async () => blob())}
      draw={draw}
      actions={given}
    />,
  );
  return { actions: given, draw };
}

const dataTransfer = (files: File[] = []) => ({ types: ['Files'], files, dropEffect: 'none' });

describe('materialgen/maps R34 R44 an empty card', () => {
  it('R34 R44 the empty square is one Choose image button inside the drop zone, named by its caption, with none of the buttons that need a map', () => {
    show(empty, 'normal');
    const card = screen.getByRole('region', { name: 'Normal' });
    const choose = within(card).getByRole('button', { name: 'Choose image' });
    expect(choose.closest('.map-half__drop')).not.toBeNull();
    expect(within(card).getAllByRole('button')).toHaveLength(1); // no second button inside the square
    expect(within(card).getByTestId('map-caption').textContent).toBe('Normal');
    for (const name of ['View Normal', 'Download Normal', 'Clear Normal', 'Restore original Normal']) expect(within(card).queryByRole('button', { name })).toBeNull();
  });

  it('R34 a file dropped on the zone is handed to the controller for that map', () => {
    const { actions: given } = show(empty, 'normal');
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.drop(screen.getByTestId('map-half').querySelector('.map-half__drop')!, { dataTransfer: dataTransfer([file]) });
    expect(given.dropFiles).toHaveBeenCalledWith('normal', [file]);
  });

  it('R64 the zone is highlighted when a file enters and cleared when it leaves, once each', () => {
    show(empty, 'normal');
    const zone = screen.getByTestId('map-half').querySelector('.map-half__drop')!;
    expect(zone.hasAttribute('data-dragging')).toBe(false);
    fireEvent.dragEnter(zone, { dataTransfer: dataTransfer() });
    fireEvent.dragEnter(zone.firstElementChild!, { dataTransfer: dataTransfer() }); // a child of the zone
    fireEvent.dragLeave(zone.firstElementChild!, { dataTransfer: dataTransfer() });
    expect(zone.hasAttribute('data-dragging')).toBe(true); // still inside the zone
    fireEvent.dragLeave(zone, { dataTransfer: dataTransfer() });
    expect(zone.hasAttribute('data-dragging')).toBe(false);
  });

  it('R34 Choose image opens a file picker whose file is handled like a drop', async () => {
    const { actions: given } = show(empty, 'height');
    const file = new File(['x'], 'h.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Choose image for Height'), file);
    expect(given.dropFiles).toHaveBeenCalledWith('height', [file]);
  });

  it('R32 a read-only card disables Choose image and Clear with the reason', () => {
    show(empty, 'normal', { canWrite: false });
    expect((screen.getByRole('button', { name: 'Choose image' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    show(put(empty, 'normal', 'n1'), 'normal', { canWrite: false });
    expect(screen.getByRole('button', { name: 'Clear Normal' }).getAttribute('aria-description')).toBe('Open in another tab');
  });
});

describe('materialgen/maps R44 R45 R47 a filled card', () => {
  const filled = (): MapsState => editMaps(put(empty, 'albedo', 'a1', { source: { kind: 'dropped', name: 'brick.png' } }), [{ kind: 'albedo', workingKey: 'a2' }], 'Filter');

  it('R44 draws the working map, names the size and the source', async () => {
    const { draw } = show(filled(), 'color');
    await waitFor(() => expect(draw).toHaveBeenCalledTimes(1));
    const caption = screen.getByTestId('map-caption'); // over the picture: the map and its size, the source in its tooltip
    expect(caption.textContent).toBe('Albedo 1024 x 1024');
    expect(caption.getAttribute('title')).toBe('Albedo 1024 x 1024 · Dropped: brick.png');
    expect(screen.getByRole('img', { name: 'Albedo thumbnail' })).toBeTruthy();
  });

  it('R45 each button names the map, in order View, Filter, Restore original, Undo, Download, Clear', () => {
    show(filled(), 'color');
    const names = within(screen.getByRole('region', { name: 'Albedo' })).getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual(['View Albedo', 'Filter Albedo', 'Restore original Albedo', 'Undo Filter (Albedo)', 'Download Albedo', 'Clear Albedo']);
  });

  it('R45 the buttons report their map to the controller', async () => {
    const { actions: given } = show(filled(), 'color');
    await userEvent.click(screen.getByRole('button', { name: 'View Albedo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restore original Albedo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Undo Filter (Albedo)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Download Albedo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear Albedo' }));
    expect(given.view).toHaveBeenCalledWith('albedo');
    expect(given.restoreOriginal).toHaveBeenCalledWith('albedo');
    expect(given.undo).toHaveBeenCalledWith(['albedo']);
    expect(given.download).toHaveBeenCalledWith('albedo');
    expect(given.requestClear).toHaveBeenCalledWith('albedo');
  });

  it('R19 Restore original is disabled while the working map is the original', () => {
    show(put(empty, 'albedo', 'a1'), 'color');
    expect((screen.getByRole('button', { name: 'Restore original Albedo' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R47 Undo is disabled without an entry', () => {
    show(put(empty, 'albedo', 'a1'), 'color');
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R32 a stale derived map shows the badge', () => {
    let state = put(put(empty, 'normal', 'n1'), 'ao', 'o1', { derivedFrom: { kind: 'normal', key: 'n1' } });
    state = editMaps(state, [{ kind: 'normal', workingKey: 'n2' }], 'Denoise');
    show(state, 'occlusion');
    expect(screen.getByText('Stale, regenerate')).toBeTruthy();
  });

  it('R30 a working file that cannot be read shows "Missing file"', async () => {
    show(filled(), 'color', { readBlob: async () => null });
    expect(await screen.findByText('Missing file')).toBeTruthy();
  });

  it('R49 a card whose map is being written shows the busy state and disables its buttons', () => {
    show(filled(), 'color', { busy: ['albedo'] });
    const zone = screen.getByTestId('map-half').querySelector('.map-half__drop')!;
    expect(zone.getAttribute('aria-busy')).toBe('true');
    expect((screen.getByRole('button', { name: 'Clear Albedo' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Undo Filter (Albedo)' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Download Albedo' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R34 an enabled Choose image has no leftover reason as its tooltip', () => {
    show(empty, 'normal');
    expect(screen.getByRole('button', { name: 'Choose image' }).getAttribute('title')).toBeNull();
  });
});


describe('materialgen/maps R45 imageops R9 the Filter button', () => {
  const filled = (): MapsState => put(empty, 'albedo', 'a1');
  const filterButton = (): HTMLButtonElement => screen.getByRole('button', { name: 'Filter Albedo' }) as HTMLButtonElement;

  it('R45 opens the filter for that map when the map exists', async () => {
    const { actions: given } = show(filled(), 'color');
    expect(filterButton().disabled).toBe(false);
    await userEvent.click(filterButton());
    expect(given.filter).toHaveBeenCalledWith('albedo');
  });

  it('R45 is not offered when there is no map, as the projection app offers no button for a picture that is not there', () => {
    show(empty, 'color');
    expect(screen.queryByRole('button', { name: 'Filter Albedo' })).toBeNull();
  });

  it('R9 is disabled, with a reason, while another op session is open', () => {
    show(filled(), 'color', { opOpen: true });
    expect(filterButton().disabled).toBe(true);
    expect(filterButton().getAttribute('title')).toContain('Another edit is open');
  });

  it('R45 is disabled while the map is being changed and when the project is read-only', () => {
    show(filled(), 'color', { busy: ['albedo'] });
    expect(filterButton().disabled).toBe(true);
    cleanup();
    show(filled(), 'color', { canWrite: false });
    expect(filterButton().disabled).toBe(true);
  });
});

describe('materialgen/maps R42 the Metal-Roughness card', () => {
  it('R42 shows a Roughness half and a Metal half, each a drop zone for its own map', () => {
    const { actions: given } = show(empty, 'metalRoughness');
    const halves = screen.getAllByTestId('map-half');
    expect(halves.map((half) => half.getAttribute('data-kind'))).toEqual(['rough', 'metal']);
    const file = new File(['x'], 'm.png', { type: 'image/png' });
    fireEvent.drop(halves[1]!.querySelector('.map-half__drop')!, { dataTransfer: dataTransfer([file]) });
    expect(given.dropFiles).toHaveBeenCalledWith('metal', [file]);
  });

  it('R42 a drop on the card outside both halves is refused with "Drop on Roughness or Metal." and the browser does not take it', () => {
    const { actions: given } = show(empty, 'metalRoughness');
    const file = new File(['x'], 'm.png', { type: 'image/png' });
    const notCancelled = fireEvent.drop(screen.getByRole('region', { name: 'Metal-Roughness' }), { dataTransfer: dataTransfer([file]) });
    expect(notCancelled).toBe(false); // default prevented: the browser will not open the file
    expect(given.refuseDrop).toHaveBeenCalledWith('Drop on Roughness or Metal.');
    expect(given.dropFiles).not.toHaveBeenCalled();
  });

  it('R42 a drop on a half is handed to that half only, with no refusal', () => {
    const { actions: given } = show(empty, 'metalRoughness');
    const file = new File(['x'], 'r.png', { type: 'image/png' });
    fireEvent.drop(screen.getAllByTestId('map-half')[0]!.querySelector('.map-half__drop')!, { dataTransfer: dataTransfer([file]) });
    expect(given.dropFiles).toHaveBeenCalledTimes(1);
    expect(given.dropFiles).toHaveBeenCalledWith('rough', [file]);
    expect(given.refuseDrop).not.toHaveBeenCalled();
  });

  it('R34 a drop on a one-map card outside its zone counts as a drop on that map', () => {
    const { actions: given } = show(empty, 'normal');
    const file = new File(['x'], 'n.png', { type: 'image/png' });
    fireEvent.drop(screen.getByRole('region', { name: 'Normal' }), { dataTransfer: dataTransfer([file]) });
    expect(given.dropFiles).toHaveBeenCalledWith('normal', [file]);
  });

  it('R34 a drag of something that is not a file is left alone', () => {
    show(empty, 'normal');
    const notCancelled = fireEvent.drop(screen.getByRole('region', { name: 'Normal' }), { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(notCancelled).toBe(true);
  });

  it('R45 R47 every half has View, Filter, Restore, Download and Clear, and both carry the same Undo of the pair, none loose between the rows', () => {
    const state = editMaps(put(put(empty, 'rough', 'r1'), 'metal', 'm1'), [{ kind: 'rough', workingKey: 'r2' }, { kind: 'metal', workingKey: 'm2' }], 'Mask commit');
    show(state, 'metalRoughness');
    const card = screen.getByRole('region', { name: 'Metal-Roughness' });
    const undos = within(card).getAllByRole('button', { name: 'Undo Mask commit (Roughness, Metal)' });
    expect(undos).toHaveLength(2);
    for (const undo of undos) expect(undo.closest('.map-half__buttons')).not.toBeNull();
    expect(within(card).getByRole('button', { name: 'Clear Roughness' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Clear Metal' })).toBeTruthy();
  });
});
