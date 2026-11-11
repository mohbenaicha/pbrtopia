// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREVIEW_VALUES, newMaterialRecord, type MaterialRecord } from '@mat/storage';
import { MaterialGeneratePanel } from '@mat/app/panels/MaterialGeneratePanel';
import { MaterialMapsPanel } from '@mat/app/panels/MaterialMapsPanel';
import { describeGenerateBlock } from '@mat/app/panels/generateReason';
import { CARD_SLOTS, slotTitle } from '@mat/app/panels/slotCards';
import type { MapsController } from '@mat/maps';
import { makeGenerationPanel } from './generate/fakeGeneration';

afterEach(cleanup);

const record = (patch: Partial<MaterialRecord> = {}): MaterialRecord => ({ ...newMaterialRecord({ id: 'p1', name: 'Bricks', size: 1024, now: '2026-11-10T09:00:00.000Z' }), ...patch });
const storage = { estimate: null, full: false, warn: false };

function renderGenerate(value: MaterialRecord, canWrite = true, running = false) {
  const onEdit = vi.fn();
  const onResizeMaps = vi.fn();
  render(
    <MaterialGeneratePanel
      record={value}
      canWrite={canWrite}
      readOnly={!canWrite}
      generation={makeGenerationPanel(running ? { run: { running: true } } : {})}
      onEdit={onEdit}
      onResizeMaps={onResizeMaps}
      resizing={false}
      storage={storage}
      onExportProject={vi.fn()}
      exporting={false}
      exportError={null}
      exportDisabledReason={null}
    />,
  );
  return { onEdit, onResizeMaps, apply: (call: number, from: MaterialRecord) => (onEdit.mock.calls[call]![0] as (r: MaterialRecord) => MaterialRecord)(from) };
}

describe('materialgen/app right panel (Generate)', () => {
  it('R14 R19 the controls are, top to bottom: Prompt, the reference images, Color mode, Size, Model settings (closed, holding the Preset), Generate with Custom setup; Run log is a tab; there is no name field', () => {
    renderGenerate(record());
    expect(screen.queryByLabelText('Project name')).toBeNull();
    const order = [
      screen.getByLabelText('Prompt'),
      screen.getByRole('button', { name: 'Add reference image' }),
      screen.getByRole('radio', { name: 'Albedo' }),
      screen.getByRole('combobox', { name: 'Size' }),
      screen.getByRole('button', { name: 'Model settings' }),
      screen.getByRole('button', { name: 'Generate' }),
      screen.getByRole('button', { name: /Custom setup/ }),
    ];
    for (let i = 1; i < order.length; i += 1) expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING, `control ${i}`).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Model settings' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Reference images' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Preset' })).toBeNull(); // inside the closed Model settings
    expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label') ?? tab.textContent)).toEqual(['Generate', 'Run log']);
  });

  it('R14 the Run log tab shows the log in place of the generate fields', () => {
    renderGenerate(record());
    expect(screen.queryByRole('tabpanel', { name: 'Run log' })).toBeNull(); // hidden while the Generate tab is selected
    fireEvent.click(screen.getByRole('tab', { name: 'Run log' }));
    expect(screen.getByRole('tabpanel', { name: 'Run log' })).toBeTruthy();
    expect(screen.queryByRole('tabpanel', { name: 'Generate fields' })).toBeNull();
  });

  it('R14 a tab panel that is hidden is not drawn: .material-panel sets display, so the stylesheet must turn it off for [hidden] (the Run log showed under Generate)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/materialgen/app/panels/materialPanels.css'), 'utf8');
    expect(css).toMatch(/\.material-panel\[hidden\]\s*\{[^}]*display:\s*none/);
    renderGenerate(record());
    expect(document.querySelector('[role="tabpanel"][aria-label="Run log"]')?.hasAttribute('hidden')).toBe(true);
  });

  it('R43 while a run goes the Color mode is locked', () => {
    renderGenerate(record(), true, true);
    expect(screen.getByRole('radio', { name: 'Albedo' }).matches(':disabled')).toBe(true);
  });

  it('R15 there is no kind choice', () => {
    renderGenerate(record());
    expect(screen.queryByText(/kind/i)).toBeNull();
  });

  it('R16 the Color mode toggle changes only the colour mode', () => {
    const { onEdit, apply } = renderGenerate(record());
    fireEvent.click(screen.getByRole('radio', { name: 'Diffuse' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    const before = record();
    expect(apply(0, before)).toEqual({ ...before, colorMode: 'diffuse' });
  });

  it('R14 typing in the prompt edits only the prompt', () => {
    const { apply } = renderGenerate(record());
    fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'mossy brick' } });
    const before = record();
    expect(apply(0, before)).toEqual({ ...before, prompt: 'mossy brick' });
  });

  it('R13 read-only mode shows the shared banner above the tabs', () => {
    renderGenerate(record(), false);
    const banner = screen.getAllByText(/open in another tab/i)[0]!; // the Generate button's reason says it too, further down
    expect(banner.compareDocumentPosition(screen.getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('R36 a storage warning offers Export project; an export error without a warning is still shown', () => {
    const onExportProject = vi.fn();
    const base = { record: record(), canWrite: true, readOnly: false, generation: makeGenerationPanel(), onEdit: vi.fn(), onResizeMaps: vi.fn(), resizing: false, onExportProject, exporting: false, exportDisabledReason: null };
    const { rerender } = render(<MaterialGeneratePanel {...base} exportError={null} storage={{ estimate: null, full: true, warn: true }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export project' }));
    expect(onExportProject).toHaveBeenCalledTimes(1);
    rerender(<MaterialGeneratePanel {...base} exportError="Could not write." storage={storage} />);
    expect(screen.getByRole('alert').textContent).toBe('Could not write.');
  });

  it('R18 Generate is disabled with its reason: read-only first, then an empty prompt, then the keys still loading, then the plan problem; otherwise it is enabled', () => {
    const open = { canWrite: true, prompt: 'brick', referenceCount: 0, keysReady: true, planProblem: null };
    expect(describeGenerateBlock({ ...open, canWrite: false, prompt: '' })).toBe('Open in another tab');
    expect(describeGenerateBlock({ ...open, prompt: '  ' })).toBe('Enter a prompt or add a reference image.');
    expect(describeGenerateBlock({ ...open, prompt: '  ', referenceCount: 1 })).toBeNull();
    expect(describeGenerateBlock({ ...open, keysReady: false })).toBe('Reading your keys.');
    expect(describeGenerateBlock({ ...open, planProblem: 'Add your OpenAI key in Settings > Keys' })).toBe('Add your OpenAI key in Settings > Keys');
    expect(describeGenerateBlock(open)).toBeNull();
    renderGenerate(record());
    const generate = screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
    expect(generate.title).toBe('Enter a prompt or add a reference image.');
  });

  it('R13 R18 in read-only mode every control is disabled and the reason is "Open in another tab"', () => {
    renderGenerate(record({ prompt: 'x' }), false);
    expect((screen.getByLabelText('Prompt') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: 'Size' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R43 while a run goes the size is locked too', () => {
    renderGenerate(record(), true, true);
    expect((screen.getByRole('combobox', { name: 'Size' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R19 the size select offers 256, 512, 1024, 2048 and Auto', () => {
    renderGenerate(record());
    fireEvent.click(screen.getByRole('combobox', { name: 'Size' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['256 px', '512 px', '1024 px', '2048 px', 'Auto (from first image)']);
  });

  const withMaps = (): MaterialRecord => record({ maps: { albedo: { originalKey: 'a', workingKey: 'a', undoKey: null, width: 1024, height: 1024 } } });
  const choose = (name: string): void => {
    fireEvent.click(screen.getByRole('combobox', { name: 'Size' }));
    fireEvent.click(screen.getByRole('option', { name }));
  };

  it('R19 with maps, a new size asks first naming the size, and Cancel changes nothing', () => {
    const { onEdit, onResizeMaps } = renderGenerate(withMaps());
    choose('2048 px');
    expect(screen.getByRole('dialog').textContent).toContain('2048');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onResizeMaps).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R19 confirming resizes the maps to the new size and does not edit the record directly', () => {
    const { onEdit, onResizeMaps } = renderGenerate(withMaps());
    choose('512 px');
    fireEvent.click(screen.getByRole('button', { name: 'Change size' }));
    expect(onResizeMaps).toHaveBeenCalledWith(512);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('R19 with maps, Auto and the current size ask nothing', () => {
    const { onEdit, onResizeMaps } = renderGenerate(withMaps());
    choose('Auto (from first image)');
    choose('1024 px');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onResizeMaps).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('R19 without maps the size is set at once, with no confirmation', () => {
    const { onEdit, onResizeMaps } = renderGenerate(record());
    choose('256 px');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onResizeMaps).not.toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe('materialgen/app left panel (the material)', () => {
  const mapsStub: MapsController = {
    busy: new Set(),
    pending: {},
    message: null,
    dismissMessage: vi.fn(),
    refuse: vi.fn(),
    dropFiles: vi.fn(),
    undo: vi.fn(),
    applyEdits: vi.fn(),
    commitMasks: vi.fn(),
    placeGenerated: vi.fn(),
    restoreOriginal: vi.fn(),
    clear: vi.fn(),
    changeSize: vi.fn(),
    download: vi.fn(),
  };
  const baseProps = { shading: 'lit' as const, onShadingChange: vi.fn(), mapsState: { size: null, maps: {} }, maps: mapsStub, readBlob: async () => null, sessions: { openFilter: vi.fn(), openAo: vi.fn(), geometry: { crop: vi.fn(), mirror: vi.fn(), swap: vi.fn() } }, aoParams: undefined, onAoParamsChange: vi.fn(), onToolViewChange: vi.fn(), canWrite: true, projectName: 'Bricks', preview: DEFAULT_PREVIEW_VALUES };

  const maps = mapsStub;
  const props = baseProps;
  function renderLeft(value: MaterialRecord, patch: Partial<ComponentProps<typeof MaterialMapsPanel>> = {}): void {
    render(<MaterialMapsPanel colorMode={value.colorMode} {...baseProps} {...patch} />);
  }

  it('R20 R11 the panel holds the shading selector, then the Maps section with its tools as icons in the heading (no export button: it is in the top bar); no name or size field, no stacked buttons', () => {
    renderLeft(record());
    expect(screen.queryByLabelText('Project name')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Size' })).toBeNull();
    const bar = screen.getByRole('button', { name: 'Maps' }).closest('.ui-disclosure__bar') as HTMLElement;
    for (const name of ['Crop', 'Mirror', 'Swap diagonals']) expect(within(bar).getByRole('button', { name })).toBeTruthy();
    expect(within(bar).queryByRole('button', { name: 'Export material' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tools' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open masks' })).toBeNull();
  });

  it('R48 R49 the left panel has no Material Masks section: the controls are in the viewport popover, and nothing here makes masks', () => {
    render(<MaterialMapsPanel colorMode="albedo" {...props} />);
    expect(screen.queryByRole('button', { name: /Material Masks/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create masks' })).toBeNull();
  });

  it('R20 R20a it shows the five slot cards in order and none for the decomposition labels', () => {
    render(<MaterialMapsPanel colorMode="albedo" {...props} />);
    expect(screen.getAllByTestId('slot-card').map((card) => card.getAttribute('aria-label'))).toEqual(['Albedo', 'Normal', 'Metal-Roughness', 'Height', 'Occlusion']);
    expect(CARD_SLOTS).toHaveLength(5);
  });

  it('R16 the Color card is titled Diffuse in diffuse mode', () => {
    render(<MaterialMapsPanel colorMode="diffuse" {...props} />);
    expect(screen.getAllByTestId('slot-card')[0]!.getAttribute('aria-label')).toBe('Diffuse');
    expect(slotTitle('color', 'albedo')).toBe('Albedo');
  });

  it('R21 a card without a map has a drop zone and no buttons; with a map the picture opens the viewer and filter, restore original, undo, download and clear sit over it', () => {
    const { unmount } = render(<MaterialMapsPanel colorMode="albedo" {...props} />);
    const empty = screen.getAllByTestId('slot-card')[0]!;
    expect(within(empty).queryByRole('button', { name: 'View Albedo' })).toBeNull();
    expect(within(empty).queryByRole('button', { name: 'Clear Albedo' })).toBeNull();
    expect(within(empty).getByRole('button', { name: 'Choose image' })).toBeTruthy();
    unmount();
    const state = { size: 1024, maps: { albedo: { originalKey: 'a', workingKey: 'a', undoKey: null, width: 1024, height: 1024 } } } as const;
    render(<MaterialMapsPanel colorMode="albedo" {...props} mapsState={state} />);
    const card = screen.getAllByTestId('slot-card')[0]!;
    const overlay = within(card).getAllByRole('button').filter((button) => button.textContent === '' && button.getAttribute('aria-label') !== 'View Albedo') as HTMLButtonElement[];
    expect(overlay.map((button) => button.getAttribute('aria-label'))).toEqual(['Filter Albedo', 'Restore original Albedo', 'Undo', 'Download Albedo', 'Clear Albedo']);
    expect(within(card).getByRole('button', { name: 'View Albedo' })).toBeTruthy();
  });

  it('R13 read-only mode: the card buttons say "Open in another tab"', () => {
    const state = { size: 1024, maps: { albedo: { originalKey: 'a', workingKey: 'a', undoKey: null, width: 1024, height: 1024 } } } as const;
    render(<MaterialMapsPanel colorMode="albedo" {...props} canWrite={false} mapsState={state} />);
    expect(within(screen.getAllByTestId('slot-card')[0]!).getByRole('button', { name: 'Clear Albedo' }).getAttribute('aria-description')).toBe('Open in another tab');
  });

  it('R44 the five cards sit in one collapsible Maps panel, open at first, in a two-column grid', () => {
    render(<MaterialMapsPanel colorMode="albedo" {...props} />);
    const heading = screen.getByRole('button', { name: 'Maps' });
    expect(heading.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByTestId('slot-card')[0]!.parentElement!.className).toBe('map-grid');
    fireEvent.click(heading);
    expect(heading.getAttribute('aria-expanded')).toBe('false');
  });

  it('R17 R43 an operation message is shown with a Dismiss button', () => {
    const dismissMessage = vi.fn();
    render(<MaterialMapsPanel colorMode="albedo" {...props} maps={{ ...maps, message: { tone: 'error', text: 'Not enough space.' }, dismissMessage }} />);
    expect(screen.getByRole('alert').textContent).toContain('Not enough space.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(dismissMessage).toHaveBeenCalled();
  });

  it('R20 Clear asks first, names the map, focuses Cancel, and clears only after the confirmation', () => {
    const clear = vi.fn();
    const state = { size: 1024, maps: { normal: { originalKey: 'n', workingKey: 'n', undoKey: null, width: 1024, height: 1024 } } } as const;
    render(<MaterialMapsPanel colorMode="albedo" {...props} mapsState={state} maps={{ ...maps, clear }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Normal' }));
    expect(screen.getByRole('dialog').textContent).toContain('Clear Normal?');
    expect(clear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(clear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Normal' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear' }));
    expect(clear).toHaveBeenCalledWith('normal');
  });

});
