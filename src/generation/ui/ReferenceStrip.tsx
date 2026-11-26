import { useRef, useState } from 'react';
import { Icon, IconButton, ImageViewer, saveBlobAsFile, Tooltip } from '../../ui-kit';
import { ReferenceEditorDialog } from '../../referenceEditor';
import type { ReferenceEdit, ReferenceImage } from '../generateStore';
import { useObjectUrl } from './useObjectUrl';

interface ReferenceStripProps {
  references: ReferenceImage[];
  notice: string | null; // why something was refused, shown as plain text
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  /** reference-editor R1: with these, each swatch gets the pencil (and, once edited, the restore) button. */
  onEdit?: (id: string, edit: ReferenceEdit) => void;
  onRestore?: (id: string) => void;
}

interface ThumbnailProps {
  reference: ReferenceImage;
  onEnlarge: () => void;
  onRemove: () => void;
  onEdit: (() => void) | undefined;
  onRestore: (() => void) | undefined;
}

function Thumbnail({ reference, onEnlarge, onRemove, onEdit, onRestore }: ThumbnailProps): React.JSX.Element {
  const url = useObjectUrl(reference.blob);
  return (
    <li className="reference-strip__item">
      <Tooltip heading={reference.name} text="Click to enlarge.">
        <button type="button" className="reference-strip__thumb" aria-label={`Enlarge ${reference.name}`} onClick={onEnlarge}>
          <img src={url ?? undefined} alt={reference.name} />
        </button>
      </Tooltip>
      {onEdit !== undefined && (
        <span className="reference-strip__edit-actions">
          {reference.original !== undefined && onRestore !== undefined && (
            <Tooltip heading="Restore original" text="Brings back the picture you uploaded and drops your edits.">
              <IconButton label={`Restore original ${reference.name}`} icon={<Icon name="undo" size={10} />} compact untitled onClick={onRestore} />
            </Tooltip>
          )}
          <Tooltip heading="Edit image" text="Crop, paint over or cover parts of this reference.">
            <IconButton label={`Edit ${reference.name}`} icon={<Icon name="pencil" size={10} />} compact untitled onClick={onEdit} />
          </Tooltip>
        </span>
      )}
      <span className="reference-strip__remove">
        <IconButton label={`Remove ${reference.name}`} icon={<Icon name="close" size={10} />} compact onClick={onRemove} />
      </span>
    </li>
  );
}

// R2: the large image viewer (viewport-layout R33); Download saves the picture under its own name.
function EnlargedImage({ reference, onClose }: { reference: ReferenceImage; onClose: () => void }): React.JSX.Element {
  const url = useObjectUrl(reference.blob);
  return (
    <ImageViewer
      title={reference.name}
      src={url ?? null}
      details={[`Size: ${reference.width} x ${reference.height}`]}
      downloadLabel={`Download ${reference.name}`}
      onDownload={() => saveBlobAsFile(reference.blob, reference.name)}
      onClose={onClose}
    />
  );
}

// R2: the reference images: add, remove, click to enlarge. The refusal text comes from the panel, which knows the model's cap.
export function ReferenceStrip({ references, notice, onFiles, onRemove, onEdit, onRestore }: ReferenceStripProps): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const [enlarged, setEnlarged] = useState<ReferenceImage | null>(null);
  const [editing, setEditing] = useState<ReferenceImage | null>(null);

  return (
    <div className="reference-strip">
      <ul className="reference-strip__list">
        {references.map((reference) => (
          <Thumbnail
            key={reference.id}
            reference={reference}
            onEnlarge={() => setEnlarged(reference)}
            onRemove={() => onRemove(reference.id)}
            onEdit={onEdit === undefined ? undefined : () => setEditing(reference)}
            onRestore={onRestore === undefined ? undefined : () => onRestore(reference.id)}
          />
        ))}
        <li className="reference-strip__add-item">
          <Tooltip heading="Add reference image" text="Adds pictures the image model should look at.">
            <button type="button" className="reference-strip__add" aria-label="Add reference image" onClick={() => input.current?.click()}>
              <Icon name="plus" size={20} />
            </button>
          </Tooltip>
          {references.length === 0 && <span className="reference-strip__hint">You can add images as references</span>}
        </li>
      </ul>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Add reference images"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) onFiles(files);
        }}
      />
      {notice !== null && <p className="reference-strip__notice" role="status">{notice}</p>}
      {enlarged !== null && <EnlargedImage reference={enlarged} onClose={() => setEnlarged(null)} />}
      {editing !== null && onEdit !== undefined && (
        <ReferenceEditorDialog
          source={editing.blob}
          width={editing.width}
          height={editing.height}
          name={editing.name}
          onApply={(edit) => { onEdit(editing.id, edit); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
