import { Button, IconButton, Icon } from '../../../ui-kit';
import { CORE_CAMERA_NAMES, type CoreSheetPlan } from '../../custom/planTypes';
import type { SheetPreview, SnapshotTrim } from '../../custom/sheetPreview';
import { CameraThumb } from './CameraThumb';
import { SheetPreviewCanvas } from './SheetPreviewCanvas';
import { SheetSettingsFields, type SheetSettingsFieldsProps } from './SheetSettingsFields';

interface SheetCardProps {
  number: number; // 1-based place in the run: the first core card is the lead
  sheet: CoreSheetPlan;
  snapshots: Blob[] | null;
  trims: SnapshotTrim[] | null; // the silhouette trim of each core camera; null until measured
  preview: SheetPreview | null; // the canvas and where the tiles go; null while unknown or when the card has no camera
  pickedCamera: number | null; // the camera chosen for the keyboard path
  isTarget: boolean; // custom R8: the arrow-key marker of the picked camera is on this card
  isFirst: boolean;
  isLast: boolean;
  fields: Omit<SheetSettingsFieldsProps, 'name' | 'settings' | 'onChange'>;
  onSettings: SheetSettingsFieldsProps['onChange'];
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemoveCamera: (camera: number) => void;
  onAddPicked: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onCameraDragStart: (camera: number, event: React.DragEvent) => void; // custom R3: an assigned camera is dragged to another card or to the snapshot row
  onDragEnter: (event: React.DragEvent) => void; // custom R3: the card says what a drop here would do
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

// Custom R5: one image of the run: its cameras as thumbnails above a full-width drop area, and the model, resolution and quality.
export function SheetCard({ number, sheet, snapshots, trims, preview, pickedCamera, isTarget, isFirst, isLast, fields, onSettings, onRemove, onMove, onRemoveCamera, onAddPicked, onDragStart, onCameraDragStart, onDragEnter, onDragLeave, onDrop }: SheetCardProps): React.JSX.Element {
  return (
    <section
      className="setup-card"
      role="group"
      aria-label={`Image ${number}`}
      data-target={isTarget ? 'true' : 'false'}
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="setup-card__header">
        <button type="button" className="setup-card__handle" draggable aria-label={`Move image ${number}`} onDragStart={onDragStart}>
          <span aria-hidden="true">⠿</span>
        </button>
        <h3 className="setup-card__title">Image {number}</h3>
        {isFirst && <span className="setup-card__lead">Lead</span>}
        <span className="setup-card__header-actions">
          <span className="setup-card__move">
            {!isFirst && <IconButton label={`Move image ${number} earlier`} icon={<span aria-hidden="true">‹</span>} onClick={() => onMove(-1)} />}
            {!isLast && <IconButton label={`Move image ${number} later`} icon={<span aria-hidden="true">›</span>} onClick={() => onMove(1)} />}
          </span>
          <IconButton label={`Remove image ${number}`} icon={<Icon name="trash" />} onClick={onRemove} />
        </span>
      </header>
      <div className="setup-card__assign">
        <ul className="setup-card__cameras">
          {sheet.cameras.map((camera) => (
            <li key={camera} className="setup-card__camera" draggable onDragStart={(event) => onCameraDragStart(camera, event)}>
              <CameraThumb blob={snapshots?.[camera] ?? null} trim={trims?.[camera] ?? null} />
              <span className="setup-card__camera-name">{CORE_CAMERA_NAMES[camera]}</span>
              <IconButton label={`Remove ${CORE_CAMERA_NAMES[camera]} from image ${number}`} icon={<Icon name="close" size={10} />} compact onClick={() => onRemoveCamera(camera)} />
            </li>
          ))}
        </ul>
        <div className="setup-drop" data-testid="canvas-box">
          {preview === null ? (
            <span className="setup-drop__empty">
              <Icon name="plus" size={16} />
              Drop a perspective here
            </span>
          ) : (
            <SheetPreviewCanvas preview={preview} snapshots={snapshots} trims={trims} />
          )}
        </div>
      </div>
      {pickedCamera !== null && !sheet.cameras.includes(pickedCamera) && <Button onClick={onAddPicked}>{`Add ${CORE_CAMERA_NAMES[pickedCamera]} to image ${number}`}</Button>}
      <SheetSettingsFields {...fields} name={`Image ${number}`} settings={sheet.settings} onChange={onSettings} />
    </section>
  );
}
