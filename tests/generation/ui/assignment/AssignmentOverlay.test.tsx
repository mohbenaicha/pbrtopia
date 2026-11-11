// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssignmentOverlay, type AssignmentCardView, type AssignmentItem, type AssignmentOverlayProps } from '../../../../src/generation';

afterEach(cleanup);

const items: AssignmentItem[] = [
  { id: 0, name: 'Alpha', thumb: <span />, pinned: true },
  { id: 1, name: 'Beta', thumb: <span /> },
  { id: 2, name: 'Gamma', thumb: <span /> },
];
const cardOf = (itemIds: number[]): AssignmentCardView => ({ itemIds, settings: <span /> });

function baseProps(overrides: Partial<AssignmentOverlayProps> = {}): AssignmentOverlayProps {
  return {
    labels: { region: 'Setup', row: 'Things', emptyDrop: 'Drop a thing here' },
    items,
    cards: [cardOf([0]), cardOf([1])],
    maxCards: 3,
    canRemoveCard: () => true,
    reorderable: false,
    toolbar: <span />,
    problem: null,
    onAssign: vi.fn(),
    onUnassign: vi.fn(),
    onReorder: vi.fn(),
    onAddCard: vi.fn(),
    onRemoveCard: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}
function show(overrides: Partial<AssignmentOverlayProps> = {}): AssignmentOverlayProps {
  const props = baseProps(overrides);
  render(<AssignmentOverlay {...props} />);
  return props;
}
const chip = (name: string): HTMLElement => within(screen.getByRole('group', { name: 'Things' })).getByRole('button', { name });

describe('shared/materialgen-prep assignment overlay', () => {
  it('R22 it speaks only the labels the host gives: no camera, snapshot or map words of its own', () => {
    show();
    const text = document.body.textContent ?? '';
    for (const word of [/camera/i, /snapshot/i, /\bmap\b/i, /sheet/i]) expect(text).not.toMatch(word);
  });

  it('R26 Add image is not offered once the maximum is reached', () => {
    show({ maxCards: 2 });
    expect(screen.queryByRole('button', { name: 'Add another image' })).toBeNull();
  });

  it('R26 below the maximum the Add tile calls the host', () => {
    const props = show();
    fireEvent.click(screen.getByRole('button', { name: 'Add another image' }));
    expect(props.onAddCard).toHaveBeenCalledOnce();
  });

  it('R27 a card with no preview has no preview area and no empty frame; a null preview draws the empty frame with the host text', () => {
    show({ cards: [cardOf([0]), { ...cardOf([]), preview: null }] });
    expect(screen.getAllByTestId('canvas-box')).toHaveLength(1);
    expect(screen.getByText('Drop a thing here')).toBeTruthy();
  });

  it('R28 with no aux supplied there is no further card after the add tile', () => {
    show();
    expect(screen.getAllByRole('group', { name: /^Image \d/ })).toHaveLength(2);
  });

  it('R26a a pinned item offers no Add button on another card and the host is not asked to move it', () => {
    const props = show();
    fireEvent.click(chip('Alpha'));
    expect(screen.queryByRole('button', { name: 'Add Alpha to image 2' })).toBeNull();
    expect(props.onAssign).not.toHaveBeenCalled();
  });

  it('R26a the keyboard drop of a pinned item on another image is refused and announced', () => {
    const props = show();
    fireEvent.click(chip('Alpha'));
    fireEvent.keyDown(chip('Alpha'), { key: 'ArrowRight' });
    fireEvent.keyDown(chip('Alpha'), { key: 'ArrowRight' });
    fireEvent.keyDown(chip('Alpha'), { key: ' ' });
    expect(props.onAssign).not.toHaveBeenCalled();
    expect(props.onUnassign).not.toHaveBeenCalled();
    expect(screen.getByTestId('setup-announcement').textContent).toBe('Alpha stays on its image.');
  });

  it('R26a a pinned item cannot be dropped on the row either', () => {
    const props = show();
    fireEvent.click(chip('Alpha'));
    fireEvent.keyDown(chip('Alpha'), { key: 'ArrowLeft' });
    fireEvent.keyDown(chip('Alpha'), { key: ' ' });
    expect(props.onUnassign).not.toHaveBeenCalled();
  });

  it('R25 the keyboard target never points past the last card after a card is removed', () => {
    const props = show({ cards: [cardOf([0]), cardOf([1]), cardOf([])] });
    fireEvent.click(chip('Gamma'));
    fireEvent.keyDown(chip('Gamma'), { key: 'ArrowRight' });
    fireEvent.keyDown(chip('Gamma'), { key: 'ArrowRight' });
    fireEvent.keyDown(chip('Gamma'), { key: 'ArrowRight' });
    fireEvent.keyDown(chip('Gamma'), { key: ' ' });
    expect(props.onAssign).toHaveBeenCalledWith(2, 2);
  });

  it('R22a given an assignedTo label, an item on an image says which image holds it and an item on none says nothing', () => {
    show({ labels: { region: 'Setup', row: 'Things', emptyDrop: 'Drop', assignedTo: (n) => `On image ${n}` }, cards: [cardOf([0]), cardOf([1])] });
    const row = within(screen.getByRole('group', { name: 'Things' }));
    expect(row.getByText('On image 1')).toBeTruthy();
    expect(row.getByText('On image 2')).toBeTruthy();
    expect(row.getAllByText(/^On image/)).toHaveLength(2);
  });

  it('R22 an item\'s note is its tooltip and its accessible description', () => {
    show({ items: [{ id: 0, name: 'Alpha', thumb: <span />, pinned: true, note: 'Stays on the first image' }, items[1]!, items[2]!] });
    expect(chip('Alpha').getAttribute('title')).toBe('Stays on the first image');
    expect(chip('Alpha').getAttribute('aria-description')).toBe('Stays on the first image');
    expect(chip('Beta').getAttribute('title')).toBeNull();
  });

  it('R22a without an assignedTo label the row carries no note', () => {
    show();
    expect(within(screen.getByRole('group', { name: 'Things' })).queryByText(/image/i)).toBeNull();
  });

  it('R22 focus moves into the overlay when it opens and goes back to where it was when it closes', () => {
    const opener = document.body.appendChild(document.createElement('button'));
    opener.focus();
    const { unmount } = render(<AssignmentOverlay {...baseProps()} />);
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Setup' }));
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('R22 a reason the plan cannot be confirmed is written next to Confirm, not only in a tooltip, and Confirm is described by it', () => {
    show({ problem: 'Put a thing on an image.' });
    expect(within(screen.getByRole('status', { name: 'Why Confirm is off' })).getByText('Put a thing on an image.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R22 with nothing wrong no reason is written', () => {
    show();
    expect(screen.queryByRole('status', { name: 'Why Confirm is off' })).toBeNull();
  });

  it('R24 removing an item with a card\'s x button hands it back without a spoken message', () => {
    const props = show();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Beta from image 2' }));
    expect(props.onUnassign).toHaveBeenCalledWith(1);
    expect(screen.getByTestId('setup-announcement').textContent).toBe('');
  });
});
