// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IconButton } from '@shared/ui-kit';
import type { ExportJob } from '@mat/export';
import type { MapRecord, MapsState } from '@mat/maps';
import { DEFAULT_PREVIEW_VALUES, type PreviewValues } from '@mat/storage';
import { ExportSection } from '@mat/app/panels/export/ExportSection';
import { useExportDialog, type ExportDialogDeps } from '@mat/app/panels/export/useExportDialog';

afterEach(cleanup);

const record = (key: string): MapRecord => ({ originalKey: key, workingKey: key, undoKey: null, width: 2048, height: 2048 });
const full = (): MapsState => ({ size: 2048, maps: { albedo: record('a'), normal: record('n'), height: record('h'), rough: record('r'), metal: record('m'), ao: record('o') } });
const tilingOf = (tilingX: number, tilingY: number): PreviewValues => ({ ...DEFAULT_PREVIEW_VALUES, tilingX, tilingY });

function setup(preview: PreviewValues, patch: Partial<ExportDialogDeps> = {}) {
  const jobs: ExportJob[] = [];
  const deps: ExportDialogDeps = {
    startExport: async (job) => { jobs.push(job); return { bytes: new Uint8Array(8), fileName: 'x.zip' }; },
    saveFile: vi.fn(), storage: { getItem: () => null, setItem: () => undefined }, now: () => 'x', ...patch,
  };
  const view = renderHook((props: { preview: PreviewValues }) => useExportDialog({ projectName: 'Mossy bricks', colorMode: 'albedo', state: full(), preview: props.preview, masksRecord: undefined, readBlob: async (key) => new Blob([key]), deps }), { initialProps: { preview } });
  act(() => view.result.current.show());
  return { view, jobs };
}

describe('materialgen/export R45 the Export tiling option in the hook', () => {
  it('R45 it is off by default with a hint that names the project tiling, and options keep their shape', () => {
    const { view } = setup(tilingOf(2, 3));
    expect(view.result.current.tiling).toMatchObject({ checked: false, x: 2, y: 3, blockReason: null });
    expect(view.result.current.tiling.hint).toContain('2 x 3');
    expect(view.result.current.tiling.hint).toMatch(/tiling settings/i);
    expect(view.result.current.options).toEqual({ target: 'blender', packing: 'separate', includeHeight: true, includeAo: true, includeMasks: false, size: 2048 });
  });

  it('R45 R46 turning it on lists every picture at size x X by size x Y, and the options still carry no tiling in the choices', () => {
    const { view } = setup(tilingOf(2, 1));
    act(() => view.result.current.tiling.set(true));
    expect(view.result.current.tiling.checked).toBe(true);
    expect(view.result.current.plan.files.every((file) => file.widthPx === 4096 && file.heightPx === 2048)).toBe(true);
  });

  it('R45 with tiling 1 x 1 the switch can be on and the files are those of the plain export', () => {
    const { view } = setup(tilingOf(1, 1));
    act(() => view.result.current.tiling.set(true));
    expect(view.result.current.tiling.checked).toBe(true);
    expect(view.result.current.plan.files.every((file) => file.widthPx === 2048 && file.heightPx === 2048)).toBe(true);
  });

  it('R45 the tiling is read when it changes: a new preview value shows at once', () => {
    const { view } = setup(tilingOf(2, 1));
    act(() => view.result.current.tiling.set(true));
    view.rerender({ preview: tilingOf(3, 1) });
    expect(view.result.current.plan.files[0]).toMatchObject({ widthPx: 6144, heightPx: 2048 });
  });
});

describe('materialgen/export R48 the limit', () => {
  it('R48 over 8192 on a side the switch is blocked with its hint, reads off, and bakes nothing', () => {
    const { view } = setup(tilingOf(5, 1));
    act(() => view.result.current.tiling.set(true));
    expect(view.result.current.tiling.blockReason).toBe('Too large: lower the size or the tiling.');
    expect(view.result.current.tiling.checked).toBe(false);
    expect(view.result.current.plan.files.every((file) => file.widthPx === 2048)).toBe(true);
  });

  it('R48 a smaller size makes it available again and the earlier choice returns', () => {
    const { view } = setup(tilingOf(5, 1));
    act(() => view.result.current.tiling.set(true));
    act(() => view.result.current.setOptions({ size: 1024 }));
    expect(view.result.current.tiling.blockReason).toBeNull();
    expect(view.result.current.tiling.checked).toBe(true);
    expect(view.result.current.plan.files[0]).toMatchObject({ widthPx: 5120, heightPx: 1024 });
  });
});

describe('materialgen/export R46 R47 the job', () => {
  it('R46 the job carries the baked tiling in its options, and none when the switch is off or 1 x 1', async () => {
    const baked = setup(tilingOf(2, 3));
    act(() => baked.view.result.current.tiling.set(true));
    await act(async () => baked.view.result.current.start());
    expect(baked.jobs[0]!.options.tiling).toEqual({ x: 2, y: 3 });

    const off = setup(tilingOf(2, 3));
    await act(async () => off.view.result.current.start());
    expect(off.jobs[0]!.options.tiling).toBeUndefined();

    const one = setup(tilingOf(1, 1));
    act(() => one.view.result.current.tiling.set(true));
    await act(async () => one.view.result.current.start());
    expect(one.jobs[0]!.options.tiling).toBeUndefined();
  });

  it('R45 a dialog opened again starts with the switch off', () => {
    const { view } = setup(tilingOf(2, 2));
    act(() => view.result.current.tiling.set(true));
    act(() => view.result.current.close());
    act(() => view.result.current.show());
    expect(view.result.current.tiling.checked).toBe(false);
  });
});

function Harness({ preview }: { preview: PreviewValues }): React.JSX.Element {
  const dialog = useExportDialog({ projectName: 'Mossy bricks', colorMode: 'albedo', state: full(), preview, masksRecord: undefined, readBlob: async () => null });
  return (
    <>
      <IconButton label="Export material" icon={null} onClick={dialog.show} />
      <ExportSection dialog={dialog} />
    </>
  );
}
const openDialog = (preview: PreviewValues) => {
  render(<Harness preview={preview} />);
  fireEvent.click(screen.getByRole('button', { name: 'Export material' }));
  return within(screen.getByRole('dialog'));
};

describe('materialgen/export R45 R49 the dialog', () => {
  it('R45 the switch is labelled "Export tiling (change in tiling settings)", off, after Create emissive map, and opens no dialog', () => {
    const dialog = openDialog(tilingOf(2, 1));
    const tiling = dialog.getByRole('switch', { name: 'Export tiling (change in tiling settings)' }) as HTMLInputElement;
    expect(tiling.checked).toBe(false);
    expect(tiling.disabled).toBe(false);
    const emissive = dialog.getByRole('switch', { name: 'Create emissive map' });
    expect(emissive.compareDocumentPosition(tiling) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(tiling);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect((dialog.getByRole('switch', { name: 'Export tiling (change in tiling settings)' }) as HTMLInputElement).checked).toBe(true);
  });

  it('R49 the file list shows W x H px when tiled and S px when not', () => {
    const dialog = openDialog(tilingOf(2, 1));
    const files = within(dialog.getByRole('list', { name: 'Files' }));
    expect(files.getAllByText('2048 px').length).toBe(6);
    fireEvent.click(dialog.getByRole('switch', { name: 'Export tiling (change in tiling settings)' }));
    expect(files.getAllByText('4096 x 2048 px').length).toBe(6);
    expect(files.queryByText('2048 px')).toBeNull();
  });

  it('R48 a tiling that is too large leaves the switch disabled and unchecked', () => {
    const dialog = openDialog(tilingOf(9, 9));
    const tiling = dialog.getByRole('switch', { name: 'Export tiling (change in tiling settings)' }) as HTMLInputElement;
    expect(tiling.disabled).toBe(true);
    expect(tiling.checked).toBe(false);
  });
});
