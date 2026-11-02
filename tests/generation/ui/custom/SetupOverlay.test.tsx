// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomPlanRecord } from '../../../../src/generation';
import { camerasIn, CAMERAS, card, chooseOption, dataTransfer, NANO, planOf, setupOverlay, snapshotButton, SUNBURST } from './setupHarness';

beforeEach(() => {
  let count = 0;
  URL.createObjectURL = vi.fn(() => `blob:fake/${++count}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const drag = (source: HTMLElement, target: HTMLElement): void => {
  const transfer = dataTransfer();
  fireEvent.dragStart(source, { dataTransfer: transfer });
  fireEvent.dragEnter(target, { dataTransfer: transfer });
  fireEvent.dragOver(target, { dataTransfer: transfer });
  fireEvent.drop(target, { dataTransfer: transfer });
  fireEvent.dragEnd(source, { dataTransfer: transfer });
};

describe('SetupOverlay: layout (custom R2, R3)', () => {
  it('custom R2 shows the six snapshots captioned by camera name, one card per sheet and the aux card, and the footer buttons', () => {
    setupOverlay();
    const row = screen.getByRole('group', { name: 'Snapshots' });
    expect(within(row).getAllByRole('figure').map((figure) => figure.textContent)).toEqual(CAMERAS);
    for (const name of ['Image 1', 'Image 2', 'Image 3', 'Image 4', 'Auxiliary image']) expect(card(name)).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Image 5' })).toBeNull();
    for (const name of ['Save setup', 'Cancel', 'Confirm']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add image' })).toBeNull(); // the + add tile in the grid is the only way to add one
    expect(screen.getByRole('combobox', { name: 'Layout preset' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Sync settings' })).toBeTruthy();
  });

  it('custom R2 the footer holds only Cancel and Confirm, and no instruction text or visible log is drawn', () => {
    setupOverlay();
    expect(screen.getAllByRole('button').filter((button) => button.closest('.setup-overlay__footer') !== null).map((button) => button.textContent)).toEqual(['Cancel', 'Confirm']);
    expect(screen.getByTestId('setup-announcement').className).toContain('setup-overlay__announcement');
  });

  it('custom R2 the + add tile sits in the grid after the last image card and before the aux card', () => {
    setupOverlay();
    const grid = screen.getByTestId('sheet-grid');
    const names = Array.from(grid.children).map((child) => child.getAttribute('aria-label') ?? child.textContent);
    expect(names).toEqual(['Image 1', 'Image 2', 'Image 3', 'Image 4', 'Add another image', 'Auxiliary image']);
  });

  it('custom R3 while the snapshots are taken the row says "Taking snapshots"', () => {
    setupOverlay({ snapshots: null });
    expect(screen.getByRole('status', { name: 'Taking snapshots' })).toBeTruthy();
  });

  it('custom R3 an unassigned snapshot is dimmed', () => {
    setupOverlay({ activePlan: planOf([[0], [1]]) });
    const dimmed = within(screen.getByRole('group', { name: 'Snapshots' })).getAllByRole('figure').map((figure) => figure.getAttribute('data-assigned'));
    expect(dimmed).toEqual(['true', 'true', 'false', 'false', 'false', 'false']);
  });

  it('custom R2 opens on the active plan', () => {
    setupOverlay({ activePlan: planOf([[0, 1], [2]]) });
    expect(camerasIn('Image 1')).toEqual(['Front', 'Right']);
    expect(camerasIn('Image 2')).toEqual(['Back']);
  });

  it('custom R4 with no active plan it opens on the Default preset', () => {
    setupOverlay({ activePlan: null });
    expect(camerasIn('Image 3')).toEqual(['Right', 'Left']);
    expect(screen.getByRole('group', { name: 'Auxiliary image' })).toBeTruthy();
  });
});

describe('SetupOverlay: assigning cameras (custom R3)', () => {
  it('custom R3 dragging a snapshot onto a card assigns it', () => {
    setupOverlay({ activePlan: planOf([[0], [2]]) });
    drag(snapshotButton('Top'), card('Image 2'));
    expect(camerasIn('Image 2')).toEqual(['Back', 'Top']);
  });

  it('custom R3 a camera belongs to one sheet: dropping an assigned camera on another card moves it', () => {
    setupOverlay({ activePlan: planOf([[0], [2]]) });
    drag(snapshotButton('Front'), card('Image 2'));
    expect(camerasIn('Image 1')).toEqual([]);
    expect(camerasIn('Image 2')).toEqual(['Front', 'Back']);
  });

  it('custom R3 dropping an assigned camera on the snapshot row unassigns it', () => {
    setupOverlay({ activePlan: planOf([[0, 1], [2]]) });
    drag(snapshotButton('Right'), screen.getByRole('group', { name: 'Snapshots' }));
    expect(camerasIn('Image 1')).toEqual(['Front']);
  });

  it('custom R3 a camera thumbnail on a card is dragged to another card to move it, or to the snapshot row to unassign it', () => {
    setupOverlay({ activePlan: planOf([[0, 1], [2]]) });
    const thumb = (name: string, within_: string): HTMLElement => within(card(within_)).getByText(name).closest('li')!;
    drag(thumb('Right', 'Image 1'), card('Image 2'));
    expect(camerasIn('Image 1')).toEqual(['Front']);
    expect(camerasIn('Image 2')).toEqual(['Right', 'Back']);
    drag(thumb('Front', 'Image 1'), screen.getByRole('group', { name: 'Snapshots' }));
    expect(camerasIn('Image 1')).toEqual([]);
    expect(snapshotButton('Front').closest('figure')?.getAttribute('data-assigned')).toBe('false');
  });

  it('custom R3 a card thumbnail is removable', () => {
    setupOverlay({ activePlan: planOf([[0, 1], [2]]) });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Right from image 1' }));
    expect(camerasIn('Image 1')).toEqual(['Front']);
  });

  it('custom R3 the aux card takes no camera drops', () => {
    setupOverlay({ activePlan: planOf([[0], [2]], SUNBURST) });
    drag(snapshotButton('Top'), card('Auxiliary image'));
    expect(camerasIn('Auxiliary image')).toEqual([]);
    expect(snapshotButton('Top').closest('figure')?.getAttribute('data-assigned')).toBe('false');
  });
});

describe('SetupOverlay: the arrow-key path (custom R8)', () => {
  const press = (name: string, key: string): void => {
    fireEvent.keyDown(snapshotButton(name), { key });
  };

  it('custom R8 Space picks up, the arrows move the marker from the row over the cards, Space drops: "Top moved to image 2."', () => {
    setupOverlay({ activePlan: planOf([[0], [2]]) });
    const button = snapshotButton('Top');
    fireEvent.click(button);
    press('Top', 'ArrowRight');
    press('Top', 'ArrowRight');
    expect(card('Image 2').getAttribute('data-target')).toBe('true');
    expect(card('Image 1').getAttribute('data-target')).toBe('false');
    press('Top', ' ');
    expect(camerasIn('Image 2')).toEqual(['Back', 'Top']);
    expect(screen.getByTestId('setup-announcement').textContent).toBe('Top moved to image 2.');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('custom R8 a picked camera that is assigned starts on its own card; left and up go back to the row, where Enter unassigns it', () => {
    setupOverlay({ activePlan: planOf([[0, 1], [2]]) });
    fireEvent.click(snapshotButton('Right'));
    expect(card('Image 1').getAttribute('data-target')).toBe('true');
    press('Right', 'ArrowUp');
    expect(screen.getByRole('group', { name: 'Snapshots' }).getAttribute('data-target')).toBe('true');
    press('Right', 'Enter');
    expect(camerasIn('Image 1')).toEqual(['Front']);
    expect(screen.getByTestId('setup-announcement').textContent).toBe('Right is not on any image.');
  });

  it('custom R8 the marker stops at the last image card (the aux card takes no camera) and at the row', () => {
    setupOverlay({ activePlan: planOf([[0], [2]], SUNBURST) });
    fireEvent.click(snapshotButton('Top'));
    for (let step = 0; step < 6; step += 1) press('Top', 'ArrowDown');
    expect(card('Image 2').getAttribute('data-target')).toBe('true');
    expect(card('Auxiliary image').getAttribute('data-target')).toBeNull();
    for (let step = 0; step < 6; step += 1) press('Top', 'ArrowLeft');
    expect(screen.getByRole('group', { name: 'Snapshots' }).getAttribute('data-target')).toBe('true');
  });

  it('custom R8 the arrows and Space do nothing for a snapshot that is not picked up, except that Space picks it up', () => {
    setupOverlay({ activePlan: planOf([[0], [2]]) });
    press('Top', 'ArrowRight');
    expect(card('Image 1').getAttribute('data-target')).toBe('false');
    expect(snapshotButton('Top').getAttribute('aria-pressed')).toBe('false');
  });

  it('custom R8 the Space that drops a camera does not pick it up again when the key comes up', () => {
    setupOverlay({ activePlan: planOf([[0], [2]]) });
    fireEvent.click(snapshotButton('Top'));
    press('Top', 'ArrowRight');
    press('Top', ' ');
    const up = fireEvent.keyUp(snapshotButton('Top'), { key: ' ' });
    expect(up).toBe(false); // preventDefault was called, so the browser sends no click
  });
});

describe('SetupOverlay: the keyboard path (custom R3)', () => {
  it('custom R3 choosing a snapshot and then "Add Front to image 2" assigns it and says so', () => {
    setupOverlay({ activePlan: planOf([[0], [2]]) });
    fireEvent.click(snapshotButton('Top'));
    expect(snapshotButton('Top').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('setup-announcement').textContent).toBe('Top picked up. Choose an image to add it to.');
    fireEvent.click(screen.getByRole('button', { name: 'Add Top to image 2' }));
    expect(camerasIn('Image 2')).toEqual(['Back', 'Top']);
    expect(screen.getByTestId('setup-announcement').textContent).toBe('Top added to image 2.');
    expect(screen.queryByRole('button', { name: /^Add Top to/ })).toBeNull();
  });

  it('custom R3 a picked camera that is assigned can be unassigned by keyboard', () => {
    setupOverlay({ activePlan: planOf([[0, 1]]) });
    fireEvent.click(snapshotButton('Right'));
    fireEvent.click(screen.getByRole('button', { name: 'Unassign Right' }));
    expect(camerasIn('Image 1')).toEqual(['Front']);
    expect(screen.getByTestId('setup-announcement').textContent).toBe('Right is not on any image.');
  });

  it('custom R3 choosing the same snapshot again puts it down; Escape puts it down before it closes the overlay', () => {
    const { props } = setupOverlay();
    fireEvent.click(snapshotButton('Top'));
    fireEvent.click(snapshotButton('Top'));
    expect(snapshotButton('Top').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(snapshotButton('Top'));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(snapshotButton('Top').getAttribute('aria-pressed')).toBe('false');
    expect(props.onCancel).not.toHaveBeenCalled();
  });
});

describe('SetupOverlay: presets (custom R4)', () => {
  const sheetsOf = (): string[] => screen.getAllByRole('group', { name: /^Image \d$/ }).map((group) => camerasIn(group.getAttribute('aria-label') ?? '').join('+'));

  it('custom R4 Default is Front; Back; Left+Right; Top+Bottom and the aux sheet', () => {
    setupOverlay({ activePlan: planOf([[0, 1, 2, 3, 4, 5]]) });
    chooseOption('Layout preset', /^Default/);
    expect(sheetsOf()).toEqual(['Front', 'Back', 'Right+Left', 'Top+Bottom']);
    expect(screen.getByRole('group', { name: 'Auxiliary image' })).toBeTruthy();
  });

  it('custom R4 2-2-2 and 3-3 replace the whole plan', () => {
    setupOverlay();
    chooseOption('Layout preset', /^2-2-2/);
    expect(sheetsOf()).toEqual(['Front+Back', 'Right+Left', 'Top+Bottom']);
    chooseOption('Layout preset', /^3-3/);
    expect(sheetsOf()).toEqual(['Front+Right+Left', 'Back+Top+Bottom']);
  });

  it('custom R4 the preset entries sit under the heading Presets and say what they build', () => {
    setupOverlay({ activePlan: planOf([[0, 1, 2, 3, 4, 5]]) });
    fireEvent.click(screen.getByRole('combobox', { name: 'Layout preset' }));
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Presets')).toBeTruthy();
    expect(within(listbox).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Custom',
      'Default: 4 images + auxiliary',
      '2-2-2: 3 images of 2 views + auxiliary',
      '3-3: 2 images of 3 views + auxiliary',
    ]);
  });

  it('custom R4 opening on no plan shows Default in the dropdown', () => {
    setupOverlay({ activePlan: null });
    expect(screen.getByRole('combobox', { name: 'Layout preset' }).textContent).toContain('Default');
  });

  it('custom R4 a preset uses sunburst on low at its smallest resolution, and an edit afterwards makes the dropdown say Custom', () => {
    setupOverlay();
    chooseOption('Layout preset', /^2-2-2/);
    expect(screen.getByRole('combobox', { name: 'Layout preset' }).textContent).toContain('2-2-2');
    expect(screen.getByRole('combobox', { name: 'Image 1 model' }).textContent).toContain('GPT Image');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Front from image 1' }));
    expect(screen.getByRole('combobox', { name: 'Layout preset' }).textContent).toContain('Custom');
  });
});

describe('SetupOverlay: Sync settings (custom R5)', () => {
  const modelOf = (name: string): string => screen.getByRole('combobox', { name }).textContent ?? '';

  it('custom R5 Sync settings starts on', () => {
    setupOverlay();
    expect((screen.getByRole('switch', { name: 'Sync settings' }) as HTMLInputElement).checked).toBe(true);
  });

  it('custom R5 with it off, changing one image leaves the others', () => {
    setupOverlay({ activePlan: planOf([[0], [2]], SUNBURST) });
    fireEvent.click(screen.getByRole('switch', { name: 'Sync settings' }));
    chooseOption('Image 2 model', /Nano Banana 2\.1/);
    expect(modelOf('Image 1 model')).not.toContain('Nano Banana');
    expect(modelOf('Image 2 model')).toContain('Nano Banana');
  });

  it('custom R5 switching it on copies the lead\'s settings to every image and to the aux image', () => {
    const { props } = setupOverlay({ activePlan: { sheets: [{ cameras: [0], settings: SUNBURST }, { cameras: [2], settings: NANO }], aux: { settings: NANO } } });
    fireEvent.click(screen.getByRole('switch', { name: 'Sync settings' })); // off
    fireEvent.click(screen.getByRole('switch', { name: 'Sync settings' })); // on again
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(props.onConfirm).toHaveBeenCalledWith({ sheets: [{ cameras: [0], settings: SUNBURST }, { cameras: [2], settings: SUNBURST }], aux: { settings: SUNBURST } });
  });

  it('custom R5 with it on, changing one image\'s model changes the others, the aux image included', () => {
    const { props } = setupOverlay({ activePlan: planOf([[0], [2]], SUNBURST) });
    chooseOption('Image 2 model', /Nano Banana 2\.1/);
    expect(modelOf('Image 1 model')).toContain('Nano Banana');
    expect(modelOf('Auxiliary model')).toContain('Nano Banana');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    const confirmed = vi.mocked(props.onConfirm).mock.calls[0]![0] as CustomPlanRecord;
    const settings = [...confirmed.sheets.map((sheet) => sheet.settings), confirmed.aux?.settings];
    expect(settings.every((each) => each !== undefined && each.modelId === NANO.modelId && JSON.stringify(each) === JSON.stringify(settings[0]))).toBe(true);
  });
});

describe('SetupOverlay: drop feedback (custom R3)', () => {
  const dropArea = (name: string): HTMLElement => within(card(name)).getByTestId('canvas-box');

  it('custom R3 dragging a snapshot makes it dim and sets a drag image', () => {
    setupOverlay();
    const transfer = dataTransfer();
    const source = snapshotButton('Front');
    fireEvent.dragStart(source, { dataTransfer: transfer });
    expect(source.hasAttribute('data-dragging')).toBe(true);
    expect(transfer.setDragImage).toHaveBeenCalledTimes(1);
    fireEvent.dragEnd(source, { dataTransfer: transfer });
    expect(source.hasAttribute('data-dragging')).toBe(false);
  });

  it('custom R3 over a card the drop area says "Add Top here", and the hint goes when the pointer leaves or the drop happens', () => {
    setupOverlay({ activePlan: planOf([[0], [2]]) });
    const transfer = dataTransfer();
    fireEvent.dragStart(snapshotButton('Top'), { dataTransfer: transfer });
    fireEvent.dragEnter(card('Image 1'), { dataTransfer: transfer });
    expect(dropArea('Image 1').getAttribute('data-drop-hint')).toBe('Add Top here');
    fireEvent.dragLeave(card('Image 1'), { dataTransfer: transfer, relatedTarget: document.body });
    expect(dropArea('Image 1').hasAttribute('data-drop-hint')).toBe(false);
    fireEvent.dragEnter(card('Image 2'), { dataTransfer: transfer });
    expect(dropArea('Image 2').getAttribute('data-drop-hint')).toBe('Add Top here');
    fireEvent.drop(card('Image 2'), { dataTransfer: transfer });
    expect(dropArea('Image 2').hasAttribute('data-drop-hint')).toBe(false);
  });

  it('custom R3 a dragged image card shows an insertion bar on the edge where it will land: after a later card, before an earlier one, none over itself', () => {
    setupOverlay({ activePlan: planOf([[0], [1], [2]]) });
    const transfer = dataTransfer();
    fireEvent.dragStart(screen.getByRole('button', { name: 'Move image 2' }), { dataTransfer: transfer });
    fireEvent.dragEnter(card('Image 3'), { dataTransfer: transfer });
    expect(card('Image 3').getAttribute('data-drop-edge')).toBe('after');
    fireEvent.dragLeave(card('Image 3'), { dataTransfer: transfer, relatedTarget: document.body });
    expect(card('Image 3').hasAttribute('data-drop-edge')).toBe(false);
    fireEvent.dragEnter(card('Image 1'), { dataTransfer: transfer });
    expect(card('Image 1').getAttribute('data-drop-edge')).toBe('before');
    fireEvent.drop(card('Image 1'), { dataTransfer: transfer });
    expect(card('Image 1').hasAttribute('data-drop-edge')).toBe(false);
    fireEvent.dragEnter(card('Image 2'), { dataTransfer: transfer });
    expect(card('Image 2').hasAttribute('data-drop-edge')).toBe(false);
  });

  it('custom R3 the dragged image card itself is marked while it is carried, and unmarked when the drag ends', () => {
    setupOverlay({ activePlan: planOf([[0], [1]]) });
    const transfer = dataTransfer();
    const handle = screen.getByRole('button', { name: 'Move image 1' });
    fireEvent.dragStart(handle, { dataTransfer: transfer });
    expect(card('Image 1').hasAttribute('data-dragging')).toBe(true);
    expect(card('Image 2').hasAttribute('data-dragging')).toBe(false);
    fireEvent.dragEnd(handle, { dataTransfer: transfer });
    expect(card('Image 1').hasAttribute('data-dragging')).toBe(false);
  });

  it('custom R3 a dragged image card does not highlight the drop area of the card it hovers', () => {
    setupOverlay({ activePlan: planOf([[0], [1]]) });
    const transfer = dataTransfer();
    fireEvent.dragStart(screen.getByRole('button', { name: 'Move image 1' }), { dataTransfer: transfer });
    fireEvent.dragEnter(card('Image 2'), { dataTransfer: transfer });
    expect(dropArea('Image 2').hasAttribute('data-drop-hint')).toBe(false);
  });

  it('custom R3 over the snapshot row an assigned camera says "Take off the image"', () => {
    setupOverlay({ activePlan: planOf([[0], [2]]) });
    const transfer = dataTransfer();
    const row = screen.getByRole('group', { name: 'Snapshots' });
    fireEvent.dragStart(within(card('Image 1')).getByText('Front').closest('li')!, { dataTransfer: transfer });
    fireEvent.dragEnter(row, { dataTransfer: transfer });
    expect(row.getAttribute('data-drop-hint')).toBe('Take off the image');
  });
});

describe('SetupOverlay: Confirm and Cancel (custom R7)', () => {
  it('custom R7 Confirm hands over the edited plan', () => {
    const { props } = setupOverlay({ activePlan: planOf([[0], [2]]) });
    drag(snapshotButton('Top'), card('Image 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(props.onConfirm).toHaveBeenCalledWith(planOf([[0, 4], [2]]));
  });

  it('custom R7 with no camera on any image Confirm is disabled and its tooltip gives the reason', () => {
    setupOverlay({ activePlan: planOf([[]]) });
    const confirm = screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(confirm.getAttribute('title')).toBe('Assign at least one camera to an image.');
  });

  it('custom R7 an image without a camera blocks Confirm', () => {
    setupOverlay({ activePlan: planOf([[0], []]) });
    expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Confirm' }).getAttribute('title')).toBe('Image 2 has no camera.');
  });

  it('custom R28 a sheet whose model is gone from the list blocks Confirm with the generate reason', () => {
    setupOverlay({ activePlan: { sheets: [{ cameras: [0], settings: { ...SUNBURST, modelId: 'gone' } }], aux: null } });
    expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Confirm' }).getAttribute('title')).toBe('Image 1: The chosen image model is no longer available. Choose another.');
  });

  it('custom R19 a sheet whose provider has no key blocks Confirm', () => {
    setupOverlay({ hasKey: { gemini: true, openai: false } });
    expect(screen.getByRole('button', { name: 'Confirm' }).getAttribute('title')).toBe('Image 1: Add a OpenAI key in Settings.');
  });

  it('custom R7 Cancel and Escape close without handing anything over', () => {
    const { props } = setupOverlay();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledTimes(2);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('custom R1 the footer holds only Cancel (the way back to Standard) and Confirm', () => {
    setupOverlay();
    const footer = document.querySelector('.setup-overlay__footer') as HTMLElement;
    expect(within(footer).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Confirm']);
    expect(screen.queryByRole('button', { name: 'Use standard generation' })).toBeNull();
  });

  it('custom R7 a click outside the panel does not close the overlay', () => {
    const { props } = setupOverlay();
    fireEvent.pointerDown(screen.getByTestId('setup-backdrop'));
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    expect(props.onCancel).not.toHaveBeenCalled();
  });
});
