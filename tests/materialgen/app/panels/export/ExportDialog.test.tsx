// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IconButton } from '@shared/ui-kit';
import type { PixelImage } from '@mat/imageops';
import { encodePng } from '../../../../../src/materialgen/maps/png/pngCodec';
import { DEFAULT_PREVIEW_VALUES } from '@mat/storage';
import { describeTooltipOf } from '../../../../support/tooltipDescription';
import type { MapRecord, MapsState } from '@mat/maps';
import { ExportSection, exportUnavailableReason } from '@mat/app/panels/export/ExportSection';
import { useExportDialog } from '@mat/app/panels/export/useExportDialog';

afterEach(cleanup);

const record = (key: string, extra: Partial<MapRecord> = {}): MapRecord => ({ originalKey: key, workingKey: key, undoKey: null, width: 1024, height: 1024, ...extra });
const full = (): MapsState => ({ size: 1024, maps: { albedo: record('a'), normal: record('n'), height: record('h'), rough: record('r'), metal: record('m'), ao: record('o') } });

/** The top-bar icon and the dialog as the project view draws them: the icon opens the dialog, which is drawn in the left panel. */
function ExportHarness({ projectName, state }: { projectName: string; state: MapsState }): React.JSX.Element {
  const dialog = useExportDialog({ projectName, colorMode: 'albedo', state, preview: DEFAULT_PREVIEW_VALUES, masksRecord: undefined, readBlob: async () => null });
  const reason = exportUnavailableReason(dialog);
  return (
    <>
      <IconButton label="Export material" icon={null} disabled={reason !== null} {...(reason === null ? {} : { disabledReason: reason })} onClick={dialog.show} />
      <ExportSection dialog={dialog} />
    </>
  );
}

function open(state: MapsState) {
  render(<ExportHarness projectName="Mossy bricks" state={state} />);
  fireEvent.click(screen.getByRole('button', { name: 'Export material' }));
  return within(screen.getByRole('dialog'));
}

describe('materialgen/export R20 the target cards', () => {
  it('R20 shows three target cards as a radio group with Blender selected, and its instructions and file names', () => {
    const dialog = open(full());
    const radios = dialog.getAllByRole('radio', { name: /Blender|Maya|Substance/ });
    expect(radios.map((radio) => (radio as HTMLInputElement).checked)).toEqual([true, false, false]);
    expect(dialog.getByRole('radiogroup', { name: 'Export for' })).toBeTruthy();
    expect(dialog.getByText(/Scripting tab/)).toBeTruthy();
    expect(dialog.getByText(/build_material\.py$/)).toBeTruthy();
  });

  it('R20 choosing another card selects it and shows its own instructions', () => {
    const dialog = open(full());
    fireEvent.click(dialog.getByRole('radio', { name: /Substance 3D Painter/ }));
    expect((dialog.getByRole('radio', { name: /Substance 3D Painter/ }) as HTMLInputElement).checked).toBe(true);
    expect(dialog.getByText(/layer stack/)).toBeTruthy();
    expect(dialog.queryByText(/Scripting tab/)).toBeNull();
  });
});

describe('materialgen/export R21 R22 R24 R27 R28 the options and the file list', () => {
  it('R21 lists every file with its size, and the list follows the packing choice', () => {
    const dialog = open(full());
    const files = within(dialog.getByRole('list', { name: 'Files' }));
    expect(files.getByText('albedo.png')).toBeTruthy();
    expect(files.getAllByText('1024 px').length).toBe(6);
    fireEvent.click(dialog.getByRole('radio', { name: 'Packed ORM' }));
    expect(files.getByText('orm.png')).toBeTruthy();
    expect(files.queryByText('roughness.png')).toBeNull();
  });

  it('R21 R24 a map that is absent is listed as Not generated and its option is disabled', () => {
    const state = full();
    delete state.maps.height;
    const dialog = open(state);
    expect(dialog.getByText('Not generated')).toBeTruthy();
    expect((dialog.getByRole('switch', { name: 'Include height' }) as HTMLInputElement).disabled).toBe(true);
    expect((dialog.getByRole('switch', { name: 'Include material masks' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('R27 an out-of-date derived map shows Out of date with the advice', () => {
    const state = full();
    state.maps.ao = record('o', { derivedFrom: { kind: 'height', key: 'older' } });
    const dialog = open(state);
    expect(dialog.getByText(/Out of date.*Regenerate it first for a matching result/)).toBeTruthy();
  });

  it('R28 no albedo with other maps shows the warning and still allows Export', () => {
    const state = full();
    delete state.maps.albedo;
    const dialog = open(state);
    expect(dialog.getByText('No albedo: the script builds the material without base colour')).toBeTruthy();
    expect((dialog.getByRole('button', { name: 'Export' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('R22 the size select is disabled when only one size exists', () => {
    const state = full();
    state.size = 256;
    const dialog = open(state);
    expect(dialog.getByRole('combobox', { name: 'Size' }).hasAttribute('disabled') || dialog.getByRole('combobox', { name: 'Size' }).getAttribute('aria-disabled') === 'true').toBe(true);
  });
});

// Export R37, R38, R43, R44: the emissive option inside the dialog. The material is 8 x 8; component 0 is the left four columns, component 1 the right four.
const smallLabels: PixelImage = { width: 8, height: 8, channels: 1, data: Uint8Array.from({ length: 64 }, (_, index) => (index % 8 < 4 ? 0 : 1)) };
const smallAlbedo: PixelImage = { width: 8, height: 8, channels: 3, data: new Uint8Array(8 * 8 * 3).fill(90) };
const emissiveRow = (label: number, name: string) => ({ label, name, description: '', location: '', defaultMaterial: 'Brick', top3: ['Brick'], matchKind: 'keyword', material: 'Brick', rough: 0.8, metal: 0, height: 0 });
const emissiveMasks = { source: 'model', feather: 0, palette: [{ label: 0, hex: '#FF0000', name: 'red' }, { label: 1, hex: '#00FF00', name: 'green' }], rows: [emissiveRow(0, 'Wall'), emissiveRow(1, 'Trim')] };
const smallState = (): MapsState => ({ size: 8 as never, maps: { albedo: record('a', { width: 8, height: 8 }), labels: record('labels1', { width: 8, height: 8 }) } });
const smallBlob = async (key: string): Promise<Blob | null> => new Blob([encodePng(key === 'labels1' ? smallLabels : smallAlbedo) as BlobPart], { type: 'image/png' });

function EmissiveHarness({ masks = emissiveMasks }: { masks?: unknown }): React.JSX.Element {
  const dialog = useExportDialog({ projectName: 'Mossy bricks', colorMode: 'albedo', state: smallState(), preview: DEFAULT_PREVIEW_VALUES, masksRecord: masks as never, readBlob: smallBlob });
  return (
    <>
      <IconButton label="Export material" icon={null} onClick={dialog.show} />
      <ExportSection dialog={dialog} />
    </>
  );
}
const openEmissive = (masks?: unknown) => {
  render(<EmissiveHarness {...(masks === undefined ? {} : { masks })} />);
  fireEvent.click(screen.getByRole('button', { name: 'Export material' }));
};
const emissiveSwitch = (): HTMLInputElement => screen.getByRole('switch', { name: 'Create emissive map' }) as HTMLInputElement;

describe('materialgen/export R37 R38 R43 R44 Create emissive map', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:picture');
    URL.revokeObjectURL = vi.fn();
  });

  it('R37 the switch is in the options after Include material masks, off, and disabled with its reason when the project has no masks', () => {
    openEmissive(null);
    expect(emissiveSwitch().checked).toBe(false);
    expect(emissiveSwitch().disabled).toBe(true);
    const masks = screen.getByRole('switch', { name: 'Include material masks' });
    expect(masks.compareDocumentPosition(emissiveSwitch()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('R37 turning it on opens the emissive dialog above the export dialog, and the switch stays off until Confirm', async () => {
    openEmissive();
    fireEvent.click(emissiveSwitch());
    expect(await screen.findByRole('dialog', { name: 'Emissive map' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Export material' })).toBeTruthy();
    expect(emissiveSwitch().checked).toBe(false);
  });

  it('R38 R43 Cancel in the emissive dialog closes only it and leaves the switch off', async () => {
    openEmissive();
    fireEvent.click(emissiveSwitch());
    const emissive = within(await screen.findByRole('dialog', { name: 'Emissive map' }));
    fireEvent.click(emissive.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Emissive map' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Export material' })).toBeTruthy();
    expect(emissiveSwitch().checked).toBe(false);
    expect(screen.queryByText('emissive.png')).toBeNull();
  });

  it('R44 a press inside the emissive dialog, and Escape, never close the export dialog behind it', async () => {
    openEmissive();
    fireEvent.click(emissiveSwitch());
    const emissive = await screen.findByRole('dialog', { name: 'Emissive map' });
    fireEvent.pointerDown(emissive);
    expect(screen.getByRole('dialog', { name: 'Export material' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Emissive map' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Export material' })).toBeTruthy();
  });

  it('R37 R41 Confirm turns the switch on and lists emissive.png; turning it off again removes it (R43)', async () => {
    openEmissive();
    fireEvent.click(emissiveSwitch());
    const emissive = within(await screen.findByRole('dialog', { name: 'Emissive map' }));
    await waitFor(() => expect(emissive.getByRole('button', { name: 'Wall' })).toBeTruthy());
    fireEvent.click(emissive.getByRole('button', { name: 'Wall' }));
    fireEvent.click(emissive.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Emissive map' })).toBeNull());
    expect(emissiveSwitch().checked).toBe(true);
    expect(screen.getByText('emissive.png')).toBeTruthy();
    fireEvent.click(emissiveSwitch());
    expect(emissiveSwitch().checked).toBe(false);
    expect(screen.queryByText('emissive.png')).toBeNull();
  });

  it('R43 closing the export dialog drops the plane: opened again, the switch is off', async () => {
    openEmissive();
    fireEvent.click(emissiveSwitch());
    const emissive = within(await screen.findByRole('dialog', { name: 'Emissive map' }));
    await waitFor(() => expect(emissive.getByRole('button', { name: 'Wall' })).toBeTruthy());
    fireEvent.click(emissive.getByRole('button', { name: 'Wall' }));
    fireEvent.click(emissive.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(emissiveSwitch().checked).toBe(true));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Export material' })).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export material' }));
    expect(emissiveSwitch().checked).toBe(false);
  });
});

describe('materialgen/export R36 Escape, Cancel and an empty list', () => {
  it('R36 Cancel closes the dialog without exporting', () => {
    const dialog = open(full());
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R36 Export material is unavailable, with its reason, when no map exists, and available when one does', () => {
    render(<ExportHarness projectName="x" state={{ size: null, maps: {} }} />);
    const button = screen.getByRole('button', { name: 'Export material' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(describeTooltipOf(button)).toBe('Export material. There is nothing to export yet.');
    cleanup();
    render(<ExportHarness projectName="x" state={full()} />);
    expect(exportUnavailableReason({ canExport: true } as never)).toBeNull();
    expect((screen.getByRole('button', { name: 'Export material' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
