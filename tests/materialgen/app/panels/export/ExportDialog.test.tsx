// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { IconButton } from '@shared/ui-kit';
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
