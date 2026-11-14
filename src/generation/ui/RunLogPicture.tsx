import { useState } from 'react';
import { Icon, IconButton, ImageViewer, saveBlobAsFile, Tooltip } from '../../ui-kit';
import { useObjectUrl } from './useObjectUrl';

interface RunLogPictureProps {
  blob: Blob;
  label: string; // "Atlas": the caption, the viewer's title and the buttons' names
  alt: string;
  fileStem: string; // "atlas": the file is `<stem>.<ext>`, the extension from the picture's type
}

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// Generate R24: one picture of a run log row. A click opens it in the large viewer; Download shows over its top-right corner and the label shows over its bottom while the pointer is on it.
export function RunLogPicture({ blob, label, alt, fileStem }: RunLogPictureProps): React.JSX.Element | null {
  const url = useObjectUrl(blob);
  const [enlarged, setEnlarged] = useState(false);
  if (url === null) return null;
  const download = (): void => saveBlobAsFile(blob, `${fileStem}.${EXTENSIONS[blob.type] ?? 'png'}`);
  return (
    <>
      <figure className="run-log-row__part run-log-row__frame">
        <button type="button" className="run-log-row__enlarge" aria-label={`Enlarge ${label}`} onClick={() => setEnlarged(true)}>
          <img className="run-log-row__picture" src={url} alt={alt} />
        </button>
        <Tooltip heading={label} text="What this picture is; click the picture to enlarge it."><figcaption className="run-log-row__label">{label}</figcaption></Tooltip>
        <span className="run-log-row__download">
          <IconButton label={`Download ${label}`} icon={<Icon name="download" size={16} />} onClick={download} />
        </span>
      </figure>
      {enlarged && <ImageViewer title={label} src={url} downloadLabel={`Download ${label}`} onDownload={download} onClose={() => setEnlarged(false)} />}
    </>
  );
}
