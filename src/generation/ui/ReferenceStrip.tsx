import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, Icon, IconButton } from '../../ui-kit';
import type { ReferenceImage } from '../generateStore';

export interface ReferenceStripProps {
  references: ReferenceImage[];
  notice: string | null; // why something was refused, shown as plain text
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
}

function useObjectUrl(blob: Blob): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const created = URL.createObjectURL(blob);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [blob]);
  return url;
}

function Thumbnail({ reference, onEnlarge, onRemove }: { reference: ReferenceImage; onEnlarge: () => void; onRemove: () => void }): React.JSX.Element {
  const url = useObjectUrl(reference.blob);
  return (
    <li className="reference-strip__item">
      <button type="button" className="reference-strip__thumb" aria-label={`Enlarge ${reference.name}`} onClick={onEnlarge}>
        <img src={url} alt={reference.name} />
      </button>
      <span className="reference-strip__remove">
        <IconButton label={`Remove ${reference.name}`} icon={<Icon name="close" size={12} />} onClick={onRemove} />
      </span>
    </li>
  );
}

function EnlargedImage({ reference }: { reference: ReferenceImage }): React.JSX.Element {
  const url = useObjectUrl(reference.blob);
  return <img className="reference-strip__enlarged" src={url} alt={reference.name} />;
}

// R2: the reference images: add, remove, click to enlarge. The refusal text comes from the panel, which knows the model's cap.
export function ReferenceStrip({ references, notice, onFiles, onRemove }: ReferenceStripProps): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const [enlarged, setEnlarged] = useState<ReferenceImage | null>(null);

  return (
    <div className="reference-strip">
      <ul className="reference-strip__list">
        {references.map((reference) => (
          <Thumbnail key={reference.id} reference={reference} onEnlarge={() => setEnlarged(reference)} onRemove={() => onRemove(reference.id)} />
        ))}
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
      <Button icon={<Icon name="plus" size={14} />} onClick={() => input.current?.click()}>Add images</Button>
      {notice !== null && <p className="reference-strip__notice" role="status">{notice}</p>}
      <Dialog open={enlarged !== null} title={enlarged?.name ?? ''} onClose={() => setEnlarged(null)} actions={<Button onClick={() => setEnlarged(null)}>Close</Button>}>
        {enlarged !== null && <EnlargedImage reference={enlarged} />}
      </Dialog>
    </div>
  );
}
