import type { ReactNode } from 'react';
import { Button, LoadingOverlay, Tooltip } from '../../../ui-kit';
import type { AssignmentItem } from './assignmentTypes';

interface ItemRowProps {
  label: string; // the group's accessible name
  busy: string | undefined;
  items: readonly AssignmentItem[];
  assigned: ReadonlyMap<number, number>; // the items that are on an image, with the number of the first image that holds each
  assignedNote?: ((imageNumber: number) => string) | undefined; // the words under an assigned item (prep R22a)
  picked: number | null;
  extra?: ReactNode; // chips that are shown but never dragged (the Metal-Roughness chip)
  onPick: (id: number) => void;
  onUnassign: (id: number) => void;
  onDragStart: (id: number, event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void; // dropping an assigned item on the row unassigns it
  onDragEnter: (event: React.DragEvent) => void; // the row says what a drop here would do
  onDragLeave: (event: React.DragEvent) => void;
  targeted: boolean; // the arrow-key marker of a picked item is on the row
  onKeyDown: (id: number, event: React.KeyboardEvent) => void;
  onKeyUp: (event: React.KeyboardEvent) => void;
}

/** Custom R3: the items in order, captioned. One is dragged onto a card; the row is also where an assigned item is dropped to unassign it. A click or Space picks one up for the keyboard path. */
export function ItemRow({ label, busy, items, assigned, assignedNote, picked, extra, onPick, onUnassign, onDragStart, onDrop, onDragEnter, onDragLeave, targeted, onKeyDown, onKeyUp }: ItemRowProps): React.JSX.Element {
  return (
    <div className="setup-snapshots" role="group" aria-label={label} data-target={targeted ? 'true' : 'false'} onDragEnter={onDragEnter} onDragOver={(event) => event.preventDefault()} onDragLeave={onDragLeave} onDrop={onDrop}>
      {items.map((item) => {
        const pickButton = (
          <button type="button" className="setup-snapshots__button" aria-label={item.name} aria-pressed={picked === item.id} draggable onDragStart={(event) => onDragStart(item.id, event)} onClick={() => onPick(item.id)} onKeyDown={(event) => onKeyDown(item.id, event)} onKeyUp={onKeyUp}>
            {item.thumb}
          </button>
        );
        return (
        <figure key={item.id} className="setup-snapshots__item" data-assigned={assigned.has(item.id) ? 'true' : 'false'}>
          {item.note === undefined ? pickButton : <Tooltip heading={item.name} text={item.note}>{pickButton}</Tooltip>}
          <figcaption>{item.name}</figcaption>
          {assignedNote !== undefined && assigned.has(item.id) && <span className="setup-snapshots__where">{assignedNote(assigned.get(item.id) ?? 0)}</span>}
          {picked === item.id && assigned.has(item.id) && item.pinned !== true && <Button onClick={() => onUnassign(item.id)}>{`Unassign ${item.name}`}</Button>}
        </figure>
        );
      })}
      {extra}
      {busy !== undefined && <LoadingOverlay label={busy} />}
    </div>
  );
}
