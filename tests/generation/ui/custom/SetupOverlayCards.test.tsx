// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { camerasIn, card, dataTransfer, NANO, planOf, setupOverlay, SUNBURST } from './setupHarness';

beforeEach(() => {
  let count = 0;
  URL.createObjectURL = vi.fn(() => `blob:fake/${++count}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const choose = (name: string, option: RegExp | string): void => {
  fireEvent.click(screen.getByRole('combobox', { name }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
};

describe('SheetCard (custom R5)', () => {
  it('custom R5 the first core card carries the lead mark and the others do not', () => {
    setupOverlay();
    expect(within(card('Image 1')).getByText('Lead')).toBeTruthy();
    expect(within(card('Image 2')).queryByText('Lead')).toBeNull();
  });

  it('custom R5 a card has model, resolution and quality selects and a preview at the canvas aspect', () => {
    setupOverlay({ previewsOf: (plan) => plan.sheets.map((_, index) => (index === 0 ? { aspect: 2, tiles: [{ camera: 0, x: 0, y: 0, w: 1, h: 1 }] } : null)) });
    for (const field of ['model', 'resolution', 'quality']) expect(screen.getByRole('combobox', { name: `Image 1 ${field}` })).toBeTruthy();
    expect(within(card('Image 1')).getByTestId('sheet-preview').style.getPropertyValue('--drop-aspect')).toBe('2');
    expect(within(card('Image 2')).queryByTestId('sheet-preview')).toBeNull();
  });

  it('custom R5 an empty card says "Drop a perspective here"; a card with cameras shows its canvas instead, and the camera thumbnails sit above the drop area, not inside', () => {
    setupOverlay({ activePlan: planOf([[0, 1, 2], []]) });
    expect(within(card('Image 2')).getByTestId('canvas-box').textContent).toBe('Drop a perspective here');
    expect(within(card('Image 1')).getByTestId('sheet-preview')).toBeTruthy();
    expect(within(card('Image 1')).getByTestId('canvas-box').textContent).not.toContain('Drop a perspective here');
    expect(camerasIn('Image 1')).toEqual(['Front', 'Right', 'Back']);
    const box = within(card('Image 1')).getByTestId('canvas-box');
    const row = within(card('Image 1')).getByRole('list');
    expect(box.contains(row)).toBe(false);
    expect(row.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('custom R5 the camera row and the drop area share one fixed-height block, so only the drop area gives way when cameras are added', () => {
    setupOverlay({ activePlan: planOf([[0, 1, 2, 3, 4, 5], []]) });
    for (const name of ['Image 1', 'Image 2']) {
      const block = within(card(name)).getByTestId('canvas-box').closest('.setup-card__assign');
      expect(block).not.toBeNull();
      expect(block!.querySelector('.setup-card__cameras')).not.toBeNull();
    }
  });

  it('custom R5 choosing another model keeps what it also offers and fits the rest', () => {
    const { props } = setupOverlay({ activePlan: planOf([[0]]) });
    choose('Image 1 model', /Nano Banana 2\.1/);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(props.onConfirm).toHaveBeenCalledWith({ sheets: [{ cameras: [0], settings: expect.objectContaining({ provider: 'gemini', modelId: NANO.modelId }) }], aux: null });
  });

  it('custom R5 the + add tile adds an empty card with the previous card\'s settings, up to six, and goes away at six', () => {
    setupOverlay({ activePlan: planOf([[0]]) });
    for (let count = 0; count < 5; count += 1) fireEvent.click(screen.getByRole('button', { name: 'Add another image' }));
    expect(screen.getAllByRole('group', { name: /^Image \d$/ })).toHaveLength(6);
    expect(screen.queryByRole('button', { name: 'Add another image' })).toBeNull();
    expect(camerasIn('Image 6')).toEqual([]);
  });

  it('custom R2 the toolbar has no Add image button and Save setup is a floppy-disc icon button', () => {
    setupOverlay({ activePlan: planOf([[0]]) });
    expect(screen.queryByRole('button', { name: 'Add image' })).toBeNull();
    const save = screen.getByRole('button', { name: 'Save setup' });
    expect(save.textContent).toBe('');
    expect(save.querySelector('svg path')).not.toBeNull();
  });

  it('custom R2 the toolbar reads Layout preset, Sync settings, then Save setup at the far right', () => {
    setupOverlay({ activePlan: planOf([[0]]) });
    const preset = screen.getByRole('combobox', { name: 'Layout preset' });
    const sync = screen.getByRole('switch', { name: 'Sync settings' });
    const save = screen.getByRole('button', { name: 'Save setup' });
    expect(preset.compareDocumentPosition(sync) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sync.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('custom R5 a card\'s remove button drops the card and unassigns its cameras', () => {
    setupOverlay({ activePlan: planOf([[0], [1, 2]]) });
    fireEvent.click(screen.getByRole('button', { name: 'Remove image 2' }));
    expect(screen.queryByRole('group', { name: 'Image 2' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Snapshots' }).querySelectorAll('[data-assigned="false"]')).toHaveLength(5);
  });

  it('custom R5 cards are reordered by drag, and the first card is the lead', () => {
    setupOverlay({ activePlan: planOf([[0], [2]]) });
    const transfer = dataTransfer();
    fireEvent.dragStart(screen.getByRole('button', { name: 'Move image 2' }), { dataTransfer: transfer });
    fireEvent.drop(card('Image 1'), { dataTransfer: transfer });
    expect(camerasIn('Image 1')).toEqual(['Back']);
    expect(within(card('Image 1')).getByText('Lead')).toBeTruthy();
  });

  it('custom R5 cards are also reordered by the keyboard: "Move image 2 earlier"', () => {
    setupOverlay({ activePlan: planOf([[0], [2]]) });
    fireEvent.click(screen.getByRole('button', { name: 'Move image 2 earlier' }));
    expect(camerasIn('Image 1')).toEqual(['Back']);
    expect(screen.getByTestId('setup-announcement').textContent).toBe('Image 2 moved to place 1.');
    expect(screen.queryByRole('button', { name: 'Move image 1 earlier' })).toBeNull();
  });
});

describe('AuxSheetCard (custom R5)', () => {
  it('custom R5 the aux card is fixed at the end with the Include auxiliary cameras checkbox, its own selects and no remove button', () => {
    setupOverlay();
    const aux = card('Auxiliary image');
    expect((within(aux).getByRole('checkbox', { name: 'Include auxiliary cameras' }) as HTMLInputElement).checked).toBe(true);
    expect(within(aux).getByTitle('Fills in what the main views cannot see. Uses one image.')).toBeTruthy();
    for (const field of ['model', 'resolution', 'quality']) expect(screen.getByRole('combobox', { name: `Auxiliary ${field}` })).toBeTruthy();
    expect(within(aux).queryByRole('button', { name: /^Remove/ })).toBeNull();
  });

  it('custom R5 unchecking it removes the aux sheet and checking it adds one with the last sheet\'s settings', () => {
    const { props } = setupOverlay({ activePlan: planOf([[0]], SUNBURST, NANO) });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include auxiliary cameras' }));
    expect(screen.queryByRole('combobox', { name: 'Auxiliary model' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include auxiliary cameras' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(props.onConfirm).toHaveBeenCalledWith({ sheets: [{ cameras: [0], settings: NANO }], aux: { settings: NANO } });
  });

  it('custom R5 with the aux sheet off the aux card still shows its checkbox, unchecked', () => {
    setupOverlay({ activePlan: planOf([[0]]) });
    expect((screen.getByRole('checkbox', { name: 'Include auxiliary cameras' }) as HTMLInputElement).checked).toBe(false);
  });
});

describe('Saved setups (custom R6)', () => {
  const saved = [{ name: 'Mine', plan: planOf([[0, 1, 2], [3, 4, 5]]) }];

  it('custom R6 Save setup asks for a name and stores the edited plan under it', () => {
    const { props } = setupOverlay({ activePlan: planOf([[0], [2]]) });
    fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    const dialog = screen.getByRole('dialog', { name: 'Save setup' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Two views' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(props.onSaveSetup).toHaveBeenCalledWith('Two views', planOf([[0], [2]]));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('custom R6 Cancel in the save dialog stores nothing', () => {
    const { props } = setupOverlay();
    fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(props.onSaveSetup).not.toHaveBeenCalled();
  });

  it('custom R6 an empty name cannot be saved', () => {
    setupOverlay();
    fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    expect((within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('custom R6 a name already used asks before replacing that setup', () => {
    const { props } = setupOverlay({ savedSetups: saved });
    fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Mine' } });
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Save setup' })).getByRole('button', { name: 'Save' }));
    expect(props.onSaveSetup).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Replace setup "Mine"?' })).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Replace setup "Mine"?' })).getByRole('button', { name: 'Replace' }));
    expect(props.onSaveSetup).toHaveBeenCalledTimes(1);
  });

  it('custom R6 saved setups are listed in the Layout preset dropdown under Saved setups: choosing one loads it, Delete setup removes it', () => {
    const { props } = setupOverlay({ savedSetups: saved });
    fireEvent.click(screen.getByRole('combobox', { name: 'Layout preset' }));
    expect(within(screen.getByRole('listbox')).getByText('Saved setups')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Mine' }));
    expect(camerasIn('Image 1')).toEqual(['Front', 'Right', 'Back']);
    expect(screen.getByRole('combobox', { name: 'Layout preset' }).textContent).toContain('Mine');
    fireEvent.click(screen.getByRole('button', { name: 'Delete setup' }));
    expect(props.onDeleteSetup).toHaveBeenCalledWith('Mine');
  });

  it('custom R6 with no saved setup chosen there is no Delete setup button', () => {
    setupOverlay({ savedSetups: saved });
    expect(screen.queryByRole('button', { name: 'Delete setup' })).toBeNull();
  });
});
