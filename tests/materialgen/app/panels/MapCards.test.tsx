// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MapsController, MapsState } from '@mat/maps';
import { MapCards } from '@mat/app/panels/MapCards';
import { encodePng, type PixelImage } from '../../../../src/materialgen/maps/png/pngCodec';

vi.mock('@mat/imageops/ui/pixelPictureUrl', () => ({ pixelsToPictureUrl: vi.fn(async () => 'blob:preview') }));

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:picture');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const picture: PixelImage = { width: 2, height: 2, channels: 3, data: new Uint8Array(12).fill(50) };
const readBlob = async (): Promise<Blob | null> => new Blob([encodePng(picture) as BlobPart], { type: 'image/png' });
const record = (key: string) => ({ originalKey: key, workingKey: key, undoKey: null, width: 2, height: 2 });
const state = { size: 2048, maps: { albedo: record('a1'), normal: record('n1') } } as unknown as MapsState;

function show(extra: { canWrite?: boolean } = {}) {
  let finishCommit: (stored: boolean) => void = () => undefined;
  const controller = {
    busy: new Set(),
    message: null,
    dismissMessage: vi.fn(),
    refuse: vi.fn(),
    dropFiles: vi.fn(),
    undo: vi.fn(),
    applyEdits: vi.fn(() => new Promise<boolean>((resolve) => { finishCommit = resolve; })),
    restoreOriginal: vi.fn(),
    clear: vi.fn(),
    changeSize: vi.fn(),
    download: vi.fn(),
  } as unknown as MapsController;
  const sessions = {
    openFilter: vi.fn(),
    openAo: vi.fn(),
    geometry: {
      crop: vi.fn(async (image: PixelImage) => image),
      mirror: vi.fn(async (image: PixelImage) => image),
      swap: vi.fn(async (image: PixelImage) => image),
      seam: vi.fn(async (image: PixelImage) => image),
    },
  };
  render(<MapCards state={state} colorMode="albedo" canWrite={extra.canWrite ?? true} controller={controller} readBlob={readBlob} sessions={sessions} aoParams={undefined} onAoParamsChange={vi.fn()} onToolViewChange={vi.fn()} />);
  return { controller, sessions, finish: (stored: boolean) => finishCommit(stored) };
}
const button = (name: string): HTMLButtonElement => screen.getByRole('button', { name }) as HTMLButtonElement;
const OTHER_OPS = ['Filter Albedo', 'Filter Normal', 'AO tool', 'Regenerate AO', 'Crop', 'Mirror', 'Swap diagonals'];

describe('materialgen/app MapCards: where the tools are', () => {
  it('R20 R43 Crop, Mirror and Swap diagonals are icons in the Maps heading; the AO tool and Regenerate AO are on the Occlusion picture', () => {
    show();
    const maps = screen.getByRole('button', { name: 'Maps' }).closest('.ui-disclosure__bar') as HTMLElement;
    for (const name of ['Crop', 'Mirror', 'Swap diagonals']) expect(within(maps).getByRole('button', { name })).toBeTruthy();
    const occlusion = screen.getByRole('region', { name: 'Occlusion' });
    for (const name of ['AO tool', 'Regenerate AO']) expect(within(occlusion).getByRole('button', { name })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open masks' })).toBeNull();
  });
});

describe('materialgen/app MapCards: View', () => {
  it('maps R46 View opens the shared zoomable viewer on the one current picture, with no panes and no internal names', async () => {
    const { controller } = show();
    const albedo = screen.getByRole('region', { name: 'Albedo' });
    fireEvent.click(within(albedo).getByRole('button', { name: /^View/ }));
    const viewer = await screen.findByRole('dialog', { name: 'Albedo' });
    await waitFor(() => expect(within(viewer).getAllByRole('img')).toHaveLength(1));
    expect(within(viewer).getByTestId('image-viewer-frame')).toBeTruthy(); // the ui-kit ImageViewer: wheel zoom, drag pan, double-click fit
    expect(within(viewer).queryByRole('slider')).toBeNull(); // no comparison divider
    expect(viewer.textContent).not.toMatch(/Working|Original|Undo copy/);
    expect(within(viewer).getByText('2048 x 2048')).toBeTruthy();
    fireEvent.click(within(viewer).getByRole('button', { name: 'Download Albedo' }));
    expect(controller.download).toHaveBeenCalledWith('albedo');
    fireEvent.click(within(viewer).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Albedo' })).toBeNull();
  });
});

describe('materialgen/app MapCards: the Crop and Mirror panel', () => {
  it('imageops R52 Crop takes the place of the slot cards in the left panel, with no dialog over the viewport, and the cards come back on Cancel', () => {
    show();
    expect(screen.getByRole('region', { name: 'Albedo' })).toBeTruthy();
    fireEvent.click(button('Crop'));
    expect(screen.getByRole('region', { name: 'Crop' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Albedo' })).toBeNull(); // the cards give way to the panel
    expect(screen.getByRole('button', { name: 'Maps' })).toBeTruthy(); // the heading stays
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('region', { name: 'Albedo' })).toBeTruthy();
  });

  it('imageops R9 R52 while the panel is open the other op buttons stay disabled', () => {
    show();
    fireEvent.click(button('Crop'));
    for (const name of ['Mirror', 'Swap diagonals']) expect(button(name).disabled).toBe(true);
  });

  it('imageops R52 opening a tool while Maps is folded unfolds it, so the panel is in view', () => {
    show();
    fireEvent.click(button('Maps')); // fold
    fireEvent.click(button('Mirror'));
    expect(screen.getByRole('region', { name: 'Mirror' }).closest('[hidden]')).toBeNull();
    expect(button('Maps').getAttribute('aria-expanded')).toBe('true');
  });
});

describe('materialgen/app MapCards: one op at a time', () => {
  it('R9 every op button starts enabled when there are maps', async () => {
    show();
    await waitFor(() => expect(button('Filter Albedo').disabled).toBe(false));
    for (const name of OTHER_OPS) expect(button(name).disabled, name).toBe(false);
  });

  it('R9 while Swap diagonals is running, no filter, AO or tool button can start', async () => {
    const { controller, finish } = show();
    await waitFor(() => expect(button('Swap diagonals').disabled).toBe(false));
    fireEvent.click(button('Swap diagonals'));
    await waitFor(() => expect(controller.applyEdits).toHaveBeenCalled()); // the swap is rendered and is being saved
    for (const name of OTHER_OPS) expect(button(name).disabled, name).toBe(true);
    await act(async () => finish(true));
    await waitFor(() => expect(button('Crop').disabled).toBe(false));
  });

  it('R9 while Regenerate is running, the Tools buttons wait', async () => {
    const { sessions, controller } = show();
    sessions.openAo.mockResolvedValue({ size: 2048, previewSize: 256, renderPreview: vi.fn(), renderFinal: vi.fn(async () => picture), close: vi.fn() });
    await waitFor(() => expect(button('Regenerate AO').disabled).toBe(false));
    fireEvent.click(button('Regenerate AO'));
    await waitFor(() => expect(controller.applyEdits).toHaveBeenCalled());
    expect(button('Crop').disabled).toBe(true);
    expect(button('Swap diagonals').disabled).toBe(true);
  });

  it('R9 R52 an open Crop panel replaces the cards (so no filter or AO button is reachable), and closing it brings them back enabled', async () => {
    show();
    await waitFor(() => expect(button('Crop').disabled).toBe(false));
    fireEvent.click(button('Crop'));
    expect(screen.queryByRole('button', { name: 'Filter Albedo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'AO tool' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(button('Filter Albedo').disabled).toBe(false);
    expect(button('AO tool').disabled).toBe(false);
  });
});
