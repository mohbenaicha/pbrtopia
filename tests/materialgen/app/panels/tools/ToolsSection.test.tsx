// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapsController, MapsState } from '@mat/maps';
import { ToolLiveContext } from '@mat/app/panels/tools/ToolLiveContext';
import { useGeometryTools } from '@mat/app/panels/tools/useGeometryTools';
import { createToolLiveFeed } from '@mat/preview/ui/toolLiveFeed';
import { encodePng, type PixelImage } from '../../../../../src/materialgen/maps/png/pngCodec';
import { describeTooltipOf, openTooltipTextOf } from '../../../../support/tooltipDescription';

afterEach(cleanup);

const picture: PixelImage = { width: 2, height: 2, channels: 3, data: new Uint8Array(12).fill(50) };
const readBlob = vi.fn(async (): Promise<Blob | null> => new Blob([encodePng(picture) as BlobPart], { type: 'image/png' }));
const record = (key: string) => ({ originalKey: key, workingKey: key, undoKey: null, width: 2, height: 2 });
const withMaps = { size: 2048, maps: { albedo: record('a1'), normal: record('n1') } } as unknown as MapsState;
const noMaps = { size: null, maps: {} } as unknown as MapsState;

type ToolsInput = Parameters<typeof useGeometryTools>[0];

/** The buttons as the Maps heading draws them, and the panel as the left panel draws it in place of the cards. */
function ToolsSection(input: ToolsInput): React.JSX.Element {
  const { buttons, panel } = useGeometryTools(input);
  return (
    <>
      {buttons}
      {panel}
    </>
  );
}

function show(patch: Partial<ToolsInput> = {}) {
  readBlob.mockClear();
  const controller = { applyEdits: vi.fn(async () => true), refuse: vi.fn() } as unknown as MapsController & { applyEdits: ReturnType<typeof vi.fn>; refuse: ReturnType<typeof vi.fn> };
  const geometry = { crop: vi.fn(async (image: PixelImage) => image), mirror: vi.fn(async (image: PixelImage) => image), swap: vi.fn(async (image: PixelImage) => image), seam: vi.fn(async (image: PixelImage) => image) };
  const onToolOpenChange = vi.fn();
  const onToolViewChange = vi.fn();
  const props = {
    state: withMaps,
    colorMode: 'albedo' as const,
    canWrite: true,
    readOnlyReason: 'Open in another tab',
    opOpen: false,
    busy: false,
    exclusive: (work: () => Promise<void>) => work(),
    geometry,
    controller,
    readBlob,
    onToolOpenChange,
    onToolViewChange,
    tiling: { x: 1, y: 1 },
    onTilingChange: vi.fn(),
    ...patch,
  } as ToolsInput;
  const live = createToolLiveFeed({ request: () => 0, cancel: () => undefined }); // the viewport's live feed (R75); no frame ever runs here, the tests read what it holds
  const wrap = (next: ToolsInput): React.JSX.Element => <ToolLiveContext.Provider value={live}><ToolsSection {...next} /></ToolLiveContext.Provider>;
  const view = render(wrap(props));
  return { controller, geometry, live, onToolOpenChange, onToolViewChange, rerender: (next: Partial<ToolsInput>) => view.rerender(wrap({ ...props, ...next })) };
}
const tool = (name: string): HTMLButtonElement => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('materialgen/app ToolsSection', () => {
  it('app tooltips R1 R5 every button of the Maps bar has a tooltip: its name and one sentence, no native title', () => {
    show();
    for (const name of ['Crop', 'Mirror', 'Swap diagonals', 'Blend edges']) {
      expect(tool(name).getAttribute('title')).toBeNull();
      const words = openTooltipTextOf(tool(name));
      expect(words.startsWith(`${name}. `)).toBe(true);
      expect(words.length).toBeGreaterThan(name.length + 20);
      expect(words.length).toBeLessThanOrEqual(name.length + 2 + 140);
    }
  });

  it('R20 Crop, Mirror and Swap diagonals are icon buttons for the Maps heading', () => {
    show();
    for (const name of ['Crop', 'Mirror', 'Swap diagonals']) expect(tool(name).disabled).toBe(false);
  });

  it('R20 with no maps every tool is disabled with a reason', () => {
    show({ state: noMaps });
    for (const name of ['Crop', 'Mirror', 'Swap diagonals']) {
      expect(tool(name).disabled).toBe(true);
      expect(describeTooltipOf(tool(name))).toContain('no maps');
    }
  });

  it('R11 a project with only the hidden labels has no map the tools can change, so they are disabled', () => {
    show({ state: { size: 2048, maps: { labels: record('l1') } } as unknown as MapsState });
    expect(tool('Crop').disabled).toBe(true);
    expect(tool('Swap diagonals').disabled).toBe(true);
  });

  it('R13 in a read-only tab every tool is disabled with that reason', () => {
    show({ canWrite: false });
    expect(tool('Crop').disabled).toBe(true);
    expect(describeTooltipOf(tool('Swap diagonals'))).toContain('Open in another tab');
  });

  it('R9 while another op session is open every tool is disabled', () => {
    show({ opOpen: true });
    expect(tool('Mirror').disabled).toBe(true);
    expect(describeTooltipOf(tool('Mirror'))).toContain('Another edit is open');
  });

  it('R21 while the maps are being changed every tool is disabled', () => {
    show({ busy: true });
    expect(tool('Crop').disabled).toBe(true);
  });

  it('R9 R52 Crop opens its panel (no dialog) and tells the host an op is open until it closes', () => {
    const { onToolOpenChange } = show();
    fireEvent.click(tool('Crop'));
    expect(screen.getByRole('region', { name: 'Crop' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onToolOpenChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'Crop' })).toBeNull();
    expect(onToolOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('R32 R52 Mirror opens its panel', () => {
    show();
    fireEvent.click(tool('Mirror'));
    expect(screen.getByRole('region', { name: 'Mirror' })).toBeTruthy();
  });

  const CROPPED_TOP = { kind: 'crop', rect: { x: 0, y: 8 / 2048, width: 1, height: 2040 / 2048 }, edge: null };

  it('R54 R58 opening the panel reads, decodes and allocates nothing, and a crop panel shows nothing until the first click', () => {
    const { onToolViewChange } = show();
    fireEvent.click(tool('Crop'));
    expect(readBlob).not.toHaveBeenCalled();
    expect(onToolViewChange).not.toHaveBeenCalled();
  });

  it('R53 R58 a click on an edge hands the viewport the new rectangle at once, with the keys of the maps it is set against, and reads nothing', () => {
    const { onToolViewChange } = show();
    fireEvent.click(tool('Crop'));
    fireEvent.click(screen.getByRole('button', { name: 'Top' }));
    expect(onToolViewChange).toHaveBeenLastCalledWith({ transform: CROPPED_TOP, baseKeys: { albedo: 'a1', normal: 'n1' }, hold: false });
    for (let i = 0; i < 20; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Left' }));
    expect(readBlob).not.toHaveBeenCalled(); // R58: any number of changes, no storage read
  });

  it('R55 hovering an edge button marks that edge, and the mark stays through a click and goes on leaving', () => {
    const { onToolViewChange } = show();
    fireEvent.click(tool('Crop'));
    const top = screen.getByRole('button', { name: 'Top' });
    fireEvent.mouseEnter(top);
    expect(onToolViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ transform: { kind: 'crop', rect: { x: 0, y: 0, width: 1, height: 1 }, edge: 'top' } }));
    fireEvent.click(top);
    expect(onToolViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ transform: { ...CROPPED_TOP, edge: 'top' } }));
    fireEvent.mouseLeave(top);
    expect(onToolViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ transform: CROPPED_TOP }));
  });

  it('R56 a mirror panel shows its starting selection at once, and a toggle changes it', () => {
    const { onToolViewChange } = show();
    fireEvent.click(tool('Mirror'));
    expect(onToolViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ transform: expect.objectContaining({ kind: 'mirror', marked: [true, true, false, false] }), hold: false }));
    fireEvent.click(screen.getByRole('button', { name: 'BL' }));
    expect(onToolViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ transform: expect.objectContaining({ kind: 'mirror' }) }));
  });

  it('R53 a roughness map is covered like any other picture map, and the hidden labels are not', () => {
    const { onToolViewChange } = show({ state: { size: 2048, maps: { rough: record('r1'), labels: record('l1') } } as unknown as MapsState });
    fireEvent.click(tool('Crop'));
    fireEvent.click(screen.getByRole('button', { name: 'Top' }));
    expect(onToolViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ baseKeys: { rough: 'r1' } }));
  });

  it('R59 Cancel clears the viewport transform at once', () => {
    const { onToolViewChange } = show();
    fireEvent.click(tool('Crop'));
    fireEvent.click(screen.getByRole('button', { name: 'Top' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onToolViewChange).toHaveBeenLastCalledWith(null);
  });

  it('R59 after a good Apply the transform is kept (held) for the host to release when the committed maps are shown', async () => {
    const { onToolViewChange } = show();
    fireEvent.click(tool('Crop'));
    fireEvent.click(screen.getByRole('button', { name: 'Top' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Crop' })).toBeNull());
    expect(onToolViewChange).toHaveBeenLastCalledWith({ transform: CROPPED_TOP, baseKeys: { albedo: 'a1', normal: 'n1' }, hold: true });
  });

  it('R61 when a working copy changes under the open panel (a generation finished), the panel closes with a message and applies nothing', async () => {
    const { controller, rerender, onToolViewChange } = show();
    fireEvent.click(tool('Crop'));
    rerender({ state: { size: 2048, maps: { albedo: record('a2'), normal: record('n1') } } as unknown as MapsState });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Crop' })).toBeNull());
    expect(controller.refuse).toHaveBeenCalledWith('The maps changed. Crop was cancelled.');
    expect(controller.applyEdits).not.toHaveBeenCalled();
    expect(onToolViewChange).toHaveBeenLastCalledWith(null);
  });

  it('R61 a change of S under the open panel cancels it too, naming the tool', async () => {
    const { controller, rerender } = show();
    fireEvent.click(tool('Mirror'));
    rerender({ state: { size: 1024, maps: withMaps.maps } as unknown as MapsState });
    await waitFor(() => expect(controller.refuse).toHaveBeenCalledWith('The maps changed. Mirror was cancelled.'));
  });

  it('R61 the maps changing because of this panel\'s own Apply is not a cancel', async () => {
    const { controller, rerender } = show();
    controller.applyEdits.mockImplementation(async () => {
      rerender({ state: { size: 2048, maps: { albedo: record('a2'), normal: record('n2') } } as unknown as MapsState });
      return true;
    });
    fireEvent.click(tool('Crop'));
    fireEvent.click(screen.getByRole('button', { name: 'Top' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Crop' })).toBeNull());
    expect(controller.refuse).not.toHaveBeenCalled();
  });

  it('R30 R11 applying a crop scales the rectangle to S on every map and commits one grouped edit', async () => {
    const { geometry, controller } = show();
    fireEvent.click(tool('Crop'));
    fireEvent.click(screen.getByRole('button', { name: 'Top' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(controller.applyEdits).toHaveBeenCalledTimes(1));
    expect(geometry.crop).toHaveBeenCalledTimes(2);
    expect(geometry.crop).toHaveBeenCalledWith(expect.anything(), 'albedo', { x: 0, y: 8, width: 2048, height: 2040 }, 2048);
    expect(controller.applyEdits).toHaveBeenCalledWith(expect.any(Array), 'Crop', true);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Crop' })).toBeNull());
  });

  it('R36 Swap diagonals runs at once on every map as one grouped edit, with no dialog', async () => {
    const { geometry, controller } = show();
    fireEvent.click(tool('Swap diagonals'));
    await waitFor(() => expect(controller.applyEdits).toHaveBeenCalledWith(expect.any(Array), 'Swap diagonals', true));
    expect(geometry.swap).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R12 a failed swap is reported as a message and nothing is committed', async () => {
    const { controller } = show({ geometry: { crop: vi.fn(), mirror: vi.fn(), swap: vi.fn(async () => { throw new Error('lost'); }), seam: vi.fn() } });
    fireEvent.click(tool('Swap diagonals'));
    await waitFor(() => expect(controller.refuse).toHaveBeenCalledWith('Could not apply (graphics error). Nothing changed.'));
    expect(controller.applyEdits).not.toHaveBeenCalled();
  });

  it('R63 Blend edges is a button after Swap diagonals that opens its panel and is disabled with no maps', () => {
    const { onToolOpenChange } = show();
    fireEvent.click(tool('Blend edges'));
    expect(screen.getByRole('region', { name: 'Blend edges' })).toBeTruthy();
    expect(onToolOpenChange).toHaveBeenLastCalledWith(true);
    cleanup();
    show({ state: noMaps });
    expect(tool('Blend edges').disabled).toBe(true);
  });

  it('R67 R69 opening Blend edges reads nothing; the viewport is told the depth at once', () => {
    const { onToolViewChange } = show();
    fireEvent.click(tool('Blend edges'));
    expect(readBlob).not.toHaveBeenCalled();
    expect(onToolViewChange).toHaveBeenLastCalledWith({ transform: { kind: 'seam', depth: 0.225, profile: null }, baseKeys: { albedo: 'a1', normal: 'n1' }, hold: false });
  });

  it('R75 Blend edges opens the viewport\'s view through state once; every slider tick after that goes to the live feed only', () => {
    const { onToolViewChange, live } = show();
    fireEvent.click(tool('Blend edges'));
    expect(onToolViewChange).toHaveBeenCalledTimes(1);
    expect(live.latest()).toEqual({ kind: 'seam', depth: 0.225, profile: null }); // the opening is also the feed's first value
    for (const value of ['60', '70', '80', '90']) fireEvent.change(screen.getByRole('slider', { name: 'Fade start' }), { target: { value } });
    expect(onToolViewChange).toHaveBeenCalledTimes(1); // no state change above the viewport for any tick
    expect(live.latest()).toEqual({ kind: 'seam', depth: 0.05, profile: null });
  });

  it('R75 closing or cancelling Blend edges empties the feed, and opening it again starts through state again', () => {
    const { onToolViewChange, live } = show();
    fireEvent.click(tool('Blend edges'));
    fireEvent.change(screen.getByRole('slider', { name: 'Fade start' }), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(live.latest()).toBeNull();
    expect(onToolViewChange).toHaveBeenLastCalledWith(null);
    onToolViewChange.mockClear();
    fireEvent.click(tool('Blend edges'));
    expect(onToolViewChange).toHaveBeenCalledTimes(1);
  });

  it('R75 Apply after slider ticks uses the last transform the panel sent, and holds it in the viewport', async () => {
    const { geometry, onToolViewChange } = show();
    fireEvent.click(tool('Blend edges'));
    fireEvent.change(screen.getByRole('slider', { name: 'Fade start' }), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(geometry.seam).toHaveBeenCalledWith(expect.anything(), 'albedo', { depth: 0.1, profile: null }));
    await waitFor(() => expect(onToolViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ transform: { kind: 'seam', depth: 0.1, profile: null }, hold: true })));
  });

  it('R66 R69 Canny reads the albedo working copy once, however often the slider moves afterwards', async () => {
    const { live } = show();
    fireEvent.click(tool('Blend edges'));
    fireEvent.click(screen.getByRole('switch', { name: 'Canny edges' }));
    await waitFor(() => expect((live.latest() as { profile: unknown }).profile).toBeInstanceOf(Float32Array));
    expect(readBlob).toHaveBeenCalledTimes(1);
    expect(readBlob).toHaveBeenCalledWith('a1');
    for (const value of ['60', '70', '80']) fireEvent.change(screen.getByRole('slider', { name: 'Fade start' }), { target: { value } });
    expect(readBlob).toHaveBeenCalledTimes(1);
  });

  it('R68 R11 applying Blend edges blends every map with the panel\'s depth and commits one grouped edit', async () => {
    const { geometry, controller } = show();
    fireEvent.click(tool('Blend edges'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(controller.applyEdits).toHaveBeenCalledTimes(1));
    expect(geometry.seam).toHaveBeenCalledTimes(2);
    expect(geometry.seam).toHaveBeenCalledWith(expect.anything(), 'albedo', { depth: 0.225, profile: null });
    expect(controller.applyEdits).toHaveBeenCalledWith(expect.any(Array), 'Blend edges', true);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Blend edges' })).toBeNull());
  });
});
