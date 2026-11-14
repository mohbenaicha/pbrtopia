import { Button, Icon, IconButton, Tooltip } from '../../../ui-kit';
import type { AssignmentCardView, AssignmentItem } from './assignmentTypes';

interface ImageCardProps {
  number: number; // 1-based place in the run: the first card is the lead
  card: AssignmentCardView;
  items: readonly AssignmentItem[];
  emptyDrop: string;
  pickedItem: AssignmentItem | null; // the item chosen for the keyboard path
  isTarget: boolean; // custom R8: the arrow-key marker of the picked item is on this card
  isFirst: boolean;
  isLast: boolean;
  canRemove: boolean; // the host decides (materials keep Image 1)
  reorderable: boolean; // projection cards can be moved; material cards keep their place
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemoveItem: (id: number) => void;
  onAddPicked: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onItemDragStart: (id: number, event: React.DragEvent) => void; // an assigned item is dragged to another card or to the row
  onDragEnter: (event: React.DragEvent) => void; // the card says what a drop here would do
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

/** Custom R5: one image of the run: its items above a full-width drop area (the host's preview), and the host's model, resolution and quality. */
export function ImageCard({ number, card, items, emptyDrop, pickedItem, isTarget, isFirst, isLast, canRemove, reorderable, onRemove, onMove, onRemoveItem, onAddPicked, onDragStart, onItemDragStart, onDragEnter, onDragLeave, onDrop }: ImageCardProps): React.JSX.Element {
  const assigned = card.itemIds.map((id) => items.find((item) => item.id === id)).filter((item): item is AssignmentItem => item !== undefined);
  return (
    <section className="setup-card" role="group" aria-label={`Image ${number}`} data-target={isTarget ? 'true' : 'false'} onDragEnter={onDragEnter} onDragOver={(event) => event.preventDefault()} onDragLeave={onDragLeave} onDrop={onDrop}>
      <header className="setup-card__header">
        {reorderable && (
          <button type="button" className="setup-card__handle" draggable aria-label={`Move image ${number}`} onDragStart={onDragStart}>
            <span aria-hidden="true">⠿</span>
          </button>
        )}
        <Tooltip heading={`Image ${number}`} text="One of the images this plan asks the model to make."><h3 className="setup-card__title">Image {number}</h3></Tooltip>
        {(card.lead ?? isFirst) && <span className="setup-card__lead">Lead</span>}
        <span className="setup-card__header-actions">
          {reorderable && (
            <span className="setup-card__move">
              {!isFirst && <IconButton label={`Move image ${number} earlier`} icon={<span aria-hidden="true">‹</span>} onClick={() => onMove(-1)} />}
              {!isLast && <IconButton label={`Move image ${number} later`} icon={<span aria-hidden="true">›</span>} onClick={() => onMove(1)} />}
            </span>
          )}
          {canRemove && <IconButton label={`Remove image ${number}`} icon={<Icon name="trash" />} onClick={onRemove} />}
        </span>
      </header>
      <div className="setup-card__assign">
        <ul className="setup-card__cameras">
          {assigned.map((item) => (
            <li key={item.id} className="setup-card__camera" draggable onDragStart={(event) => onItemDragStart(item.id, event)}>
              {item.thumb}
              <Tooltip heading={item.name} text=""><span className="setup-card__camera-name">{item.name}</span></Tooltip>
              {item.pinned !== true && <IconButton label={`Remove ${item.name} from image ${number}`} icon={<Icon name="close" size={10} />} compact onClick={() => onRemoveItem(item.id)} />}
            </li>
          ))}
        </ul>
        {card.preview !== undefined && (
          <div className="setup-drop" data-testid="canvas-box">
            {card.preview === null ? (
              <span className="setup-drop__empty">
                <Icon name="plus" size={16} />
                {emptyDrop}
              </span>
            ) : (
              card.preview
            )}
          </div>
        )}
        {card.below}
      </div>
      {pickedItem !== null && pickedItem.pinned !== true && !card.itemIds.includes(pickedItem.id) && <Button onClick={onAddPicked}>{`Add ${pickedItem.name} to image ${number}`}</Button>}
      {card.settings}
    </section>
  );
}
