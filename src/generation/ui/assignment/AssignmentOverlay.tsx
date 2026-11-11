import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Icon, useDismiss } from '../../../ui-kit';
import type { AssignmentCardView, AssignmentItem, AssignmentLabels } from './assignmentTypes';
import { clearDropHint, hasLeftTarget, markDragSource, showDropEdge, showDropHint } from './dragFeedback';
import { ImageCard } from './ImageCard';
import { ItemRow } from './ItemRow';
import './AssignmentOverlay.css';

export interface AssignmentOverlayProps {
  labels: AssignmentLabels;
  items: readonly AssignmentItem[];
  rowExtra?: ReactNode; // shown in the row, never dragged
  cards: readonly AssignmentCardView[]; // in run order; the first is the lead
  maxCards: number; // Add image is off at this many (prep S3 R26)
  canRemoveCard: (index: number) => boolean;
  reorderable: boolean;
  toolbar: ReactNode;
  aux?: ReactNode; // the fixed card after the add tile (the auxiliary or decomposition card); none drawn when left out (prep S3 R28)
  problem: string | null; // why Confirm is off
  onAssign: (id: number, cardIndex: number) => void;
  onUnassign: (id: number) => void;
  onReorder: (from: number, to: number) => void;
  onAddCard: () => void;
  onRemoveCard: (index: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

type Dragged = { kind: 'item'; id: number } | { kind: 'card'; index: number };

/** The class of the overlay's backdrop; an app that must know the overlay is open (a shortcut that stands down) selects on it. */
export const ASSIGNMENT_OVERLAY_CLASS = 'setup-overlay';
const ROW_TARGET = -1; // the item row, before the first card

/**
 * Prep S3 R22, custom R2-R8, generation R10-R13: the overlay over the viewport area. It owns the drag and drop, the keyboard path (pick an item up, steer with the arrows, drop with
 * Space), the "Add ... to image N" buttons and the live-region announcements; the host owns the plan and every noun. Escape and Cancel drop the edits, a press outside does nothing.
 */
export function AssignmentOverlay({ labels, items, rowExtra, cards, maxCards, canRemoveCard, reorderable, toolbar, aux, problem, onAssign, onUnassign, onReorder, onAddCard, onRemoveCard, onConfirm, onCancel }: AssignmentOverlayProps): React.JSX.Element {
  const [picked, setPicked] = useState<number | null>(null);
  const [target, setTarget] = useState(ROW_TARGET); // custom R8: where the picked item would be dropped: a card index, or the row
  const [announcement, setAnnouncement] = useState('');
  const dragged = useRef<Dragged | null>(null);
  const swallowSpaceRelease = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const nameOf = (id: number): string => items.find((item) => item.id === id)?.name ?? `Item ${id}`;
  const pickedItem = picked === null ? null : (items.find((item) => item.id === picked) ?? null);
  const assigned = new Map<number, number>();
  cards.forEach((card, index) => card.itemIds.forEach((id) => { if (!assigned.has(id)) assigned.set(id, index + 1); }));
  const aim = Math.min(target, cards.length - 1); // a card removed under the marker cannot leave it past the last one
  const isPinned = (id: number): boolean => items.find((item) => item.id === id)?.pinned === true;

  useEffect(() => {
    const opener = document.activeElement;
    panel.current?.focus(); // focus moves into the overlay and goes back to its opener on close
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useDismiss(true, panel, () => {
    if (panel.current?.querySelector('[role="dialog"]')) return; // a question is open: it takes Escape
    if (picked === null) onCancel();
    else putDown();
  }, false);

  const putDown = (): void => {
    setPicked(null);
    setAnnouncement('');
  };
  // Prep S3 R26a: a pinned item stays where it is.
  const refusePinned = (id: number): void => setAnnouncement(`${nameOf(id)} stays on its image.`);
  const assign = (id: number, cardIndex: number, verb: 'added to' | 'moved to'): void => {
    if (isPinned(id)) return cards[cardIndex]?.itemIds.includes(id) ? undefined : refusePinned(id);
    onAssign(id, cardIndex);
    setAnnouncement(`${nameOf(id)} ${verb} image ${cardIndex + 1}.`);
  };
  const unassign = (id: number): void => {
    if (isPinned(id)) return refusePinned(id);
    onUnassign(id);
    setAnnouncement(`${nameOf(id)} is not on any image.`);
  };
  const reorder = (from: number, to: number): void => {
    onReorder(from, to);
    setAnnouncement(`Image ${from + 1} moved to place ${to + 1}.`);
  };

  const startDrag = (item: Dragged, event: React.DragEvent): void => {
    dragged.current = item;
    event.dataTransfer.setData('text/plain', item.kind === 'item' ? `item:${item.id}` : `card:${item.index}`);
    event.dataTransfer.effectAllowed = 'move';
    const handle = event.currentTarget as HTMLElement;
    const card = handle.closest<HTMLElement>('.setup-card');
    // The marked element dims itself by its own attribute: a thumbnail, or the whole card when a card is carried (no :has() rule over every card).
    if (item.kind === 'item') markDragSource(handle, event, handle.querySelector('img'));
    else if (card !== null) markDragSource(card, event, card);
  };
  // R3: what a drop on a card or on the row would do, written on the target while the pointer is over it.
  const hintDrop = (where: 'card' | 'row', index = -1) => (event: React.DragEvent): void => {
    const item = dragged.current;
    if (item === null || (item.kind === 'card' && where === 'row')) return;
    const current = event.currentTarget as HTMLElement;
    if (item.kind === 'card') {
      if (item.index !== index) showDropEdge(current, item.index < index ? 'after' : 'before');
      return;
    }
    if (isPinned(item.id)) return;
    showDropHint(current, where === 'row' ? 'Take off the image' : `Add ${nameOf(item.id)} here`);
  };
  const unhintDrop = (event: React.DragEvent): void => {
    if (hasLeftTarget(event)) clearDropHint(event.currentTarget as HTMLElement);
  };
  const dropOnCard = (index: number, event: React.DragEvent): void => {
    event.preventDefault();
    clearDropHint(event.currentTarget as HTMLElement);
    const item = dragged.current;
    dragged.current = null;
    if (item === null) return;
    if (item.kind === 'item') assign(item.id, index, 'added to');
    else reorder(item.index, index);
  };
  const dropOnRow = (event: React.DragEvent): void => {
    event.preventDefault();
    clearDropHint(event.currentTarget as HTMLElement);
    const item = dragged.current;
    dragged.current = null;
    if (item?.kind === 'item') unassign(item.id);
  };
  const pick = (id: number): void => {
    if (picked === id) return putDown();
    setPicked(id);
    setTarget(cards.findIndex((card) => card.itemIds.includes(id))); // its own card, or the row (-1) when it is on none
    setAnnouncement(`${nameOf(id)} picked up. Choose an image to add it to.`);
  };
  // Custom R8: the arrows move the marker of the picked item (row, then the cards), Space or Enter drops it there.
  const steerPicked = (id: number, event: React.KeyboardEvent): void => {
    if (picked !== id) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      setTarget(Math.min(cards.length - 1, aim + 1));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      setTarget(Math.max(ROW_TARGET, aim - 1));
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      swallowSpaceRelease.current = event.key === ' ';
      if (aim === ROW_TARGET) unassign(id);
      else assign(id, aim, 'moved to');
      setPicked(null);
    }
  };
  // The key coming up after the dropping Space would click the item's button and pick it up again.
  const releaseKey = (event: React.KeyboardEvent): void => {
    if (event.key !== ' ' || !swallowSpaceRelease.current) return;
    event.preventDefault();
    swallowSpaceRelease.current = false;
  };

  return (
    <div className={ASSIGNMENT_OVERLAY_CLASS} data-testid="setup-backdrop">
      <div className="setup-overlay__panel" ref={panel} role="region" aria-label={labels.region} tabIndex={-1}>
        <ItemRow
          label={labels.row}
          busy={labels.busy}
          items={items}
          assigned={assigned}
          assignedNote={labels.assignedTo}
          picked={picked}
          extra={rowExtra}
          onPick={pick}
          onUnassign={(id) => {
            unassign(id);
            setPicked(null);
          }}
          onDragStart={(id, event) => startDrag({ kind: 'item', id }, event)}
          onDrop={dropOnRow}
          onDragEnter={hintDrop('row')}
          onDragLeave={unhintDrop}
          targeted={picked !== null && aim === ROW_TARGET}
          onKeyDown={steerPicked}
          onKeyUp={releaseKey}
        />
        {toolbar}
        <div className="setup-overlay__body">
          <div className="setup-overlay__grid" data-testid="sheet-grid">
            {cards.map((card, index) => (
              <ImageCard
                key={index}
                number={index + 1}
                card={card}
                items={items}
                emptyDrop={labels.emptyDrop}
                pickedItem={pickedItem}
                isTarget={picked !== null && aim === index}
                isFirst={index === 0}
                isLast={index === cards.length - 1}
                canRemove={canRemoveCard(index)}
                reorderable={reorderable}
                onRemove={() => onRemoveCard(index)}
                onMove={(delta) => reorder(index, index + delta)}
                onRemoveItem={onUnassign}
                onAddPicked={() => {
                  if (picked === null) return;
                  assign(picked, index, 'added to');
                  setPicked(null);
                }}
                onDragStart={(event) => startDrag({ kind: 'card', index }, event)}
                onItemDragStart={(id, event) => startDrag({ kind: 'item', id }, event)}
                onDragEnter={hintDrop('card', index)}
                onDragLeave={unhintDrop}
                onDrop={(event) => dropOnCard(index, event)}
              />
            ))}
            {cards.length < maxCards && (
              <button type="button" className="setup-add-tile" aria-label="Add another image" onClick={onAddCard}>
                <Icon name="plus" size={28} />
              </button>
            )}
            {aux}
          </div>
        </div>
        <div className="setup-overlay__footer">
          {problem !== null && <p className="setup-overlay__problem" role="status" aria-label="Why Confirm is off">{problem}</p>}
          <span className="setup-overlay__decision">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" disabled={problem !== null} {...(problem === null ? {} : { title: problem })} onClick={onConfirm}>Confirm</Button>
          </span>
        </div>
        <p className="setup-overlay__announcement" role="status" aria-live="polite" data-testid="setup-announcement">{announcement}</p>
      </div>
    </div>
  );
}
