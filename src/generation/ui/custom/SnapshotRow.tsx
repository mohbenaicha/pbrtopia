import { LoadingOverlay, Button } from '../../../ui-kit';
import { CORE_CAMERA_NAMES } from '../../custom/planTypes';
import type { SnapshotTrim } from '../../custom/sheetPreview';
import { CameraThumb } from './CameraThumb';

interface SnapshotRowProps {
  snapshots: Blob[] | null; // six, in core order; null while they are taken
  trims: SnapshotTrim[] | null; // each snapshot's silhouette box; null until measured
  assigned: boolean[]; // per core camera: it is on an image
  picked: number | null;
  onPick: (camera: number) => void;
  onUnassign: (camera: number) => void;
  onDragStart: (camera: number, event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void; // dropping an assigned camera on the row unassigns it
  onDragEnter: (event: React.DragEvent) => void; // custom R3: the row says what a drop here would do
  onDragLeave: (event: React.DragEvent) => void;
  targeted: boolean; // custom R8: the arrow-key marker of a picked camera is on the row
  onKeyDown: (camera: number, event: React.KeyboardEvent) => void;
  onKeyUp: (event: React.KeyboardEvent) => void;
}

// Custom R3: the six snapshots in layer order, captioned. A snapshot is dragged onto a card; the row is also where an assigned camera is dropped to unassign it.
// A click or Space picks a snapshot up for the keyboard path (R8: arrows, Space; the cards also offer "Add ... to image N").
export function SnapshotRow({ snapshots, trims, assigned, picked, onPick, onUnassign, onDragStart, onDrop, onDragEnter, onDragLeave, targeted, onKeyDown, onKeyUp }: SnapshotRowProps): React.JSX.Element {
  return (
    <div className="setup-snapshots" role="group" aria-label="Snapshots" data-target={targeted ? 'true' : 'false'} onDragEnter={onDragEnter} onDragOver={(event) => event.preventDefault()} onDragLeave={onDragLeave} onDrop={onDrop}>
      {CORE_CAMERA_NAMES.map((name, camera) => (
        <figure key={name} className="setup-snapshots__item" data-assigned={assigned[camera] === true ? 'true' : 'false'}>
          <button type="button" className="setup-snapshots__button" aria-label={name} aria-pressed={picked === camera} draggable onDragStart={(event) => onDragStart(camera, event)} onClick={() => onPick(camera)} onKeyDown={(event) => onKeyDown(camera, event)} onKeyUp={onKeyUp}>
            <CameraThumb blob={snapshots?.[camera] ?? null} trim={trims?.[camera] ?? null} />
          </button>
          <figcaption>{name}</figcaption>
          {picked === camera && assigned[camera] === true && <Button onClick={() => onUnassign(camera)}>{`Unassign ${name}`}</Button>}
        </figure>
      ))}
      {snapshots === null && <LoadingOverlay label="Taking snapshots" />}
    </div>
  );
}
