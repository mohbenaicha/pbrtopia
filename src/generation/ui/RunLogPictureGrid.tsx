import { useState } from 'react';
import { Icon, IconButton, ImageViewer, saveBlobAsFile } from '../../ui-kit';
import { useObjectUrl } from './useObjectUrl';

export interface RunLogGridCell {
  number: number; // the sheet's number in the run, for the file name
  label: string; // its camera names
  blob: Blob;
}

interface RunLogPictureGridProps {
  title: string; // "Snapshots": the group's name
  fileStem: string; // "snapshot": a file is `<stem>-<number>.<ext>`
  cells: RunLogGridCell[]; // in sheet order
}

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

function GridCell({ cell, fileStem }: { cell: RunLogGridCell; fileStem: string }): React.JSX.Element | null {
  const url = useObjectUrl(cell.blob);
  const [enlarged, setEnlarged] = useState(false);
  if (url === null) return null;
  const download = (): void => saveBlobAsFile(cell.blob, `${fileStem}-${cell.number}.${EXTENSIONS[cell.blob.type] ?? 'png'}`);
  return (
    <>
      <figure className="run-log-row__cell">
        <button type="button" className="run-log-row__enlarge" aria-label={`Enlarge ${cell.label}`} onClick={() => setEnlarged(true)}>
          <img className="run-log-row__cell-picture" src={url} alt={cell.label} />
        </button>
        <figcaption className="run-log-row__cell-label">{cell.label}</figcaption>
        <span className="run-log-row__download">
          <IconButton label={`Download ${cell.label}`} icon={<Icon name="download" size={14} />} onClick={download} />
        </span>
      </figure>
      {enlarged && <ImageViewer title={cell.label} src={url} downloadLabel={`Download ${cell.label}`} onDownload={download} onClose={() => setEnlarged(false)} />}
    </>
  );
}

// Custom R27: a custom run's pictures in one square area, `ceil(sqrt(n))` columns in sheet order, each picture fitted whole in its cell and captioned by its cameras.
export function RunLogPictureGrid({ title, fileStem, cells }: RunLogPictureGridProps): React.JSX.Element {
  const columns = Math.max(1, Math.ceil(Math.sqrt(cells.length)));
  return (
    <div className="run-log-row__part">
      <span className="run-log-row__caption">{title}</span>
      <div className="run-log-row__grid" role="group" aria-label={title} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {cells.map((cell) => (
          <GridCell key={cell.number} cell={cell} fileStem={fileStem} />
        ))}
      </div>
    </div>
  );
}
