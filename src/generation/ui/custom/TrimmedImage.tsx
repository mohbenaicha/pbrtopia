import type { SnapshotTrim } from '../../custom/sheetPreview';
import { useObjectUrl } from '../useObjectUrl';

interface TrimmedImageProps {
  blob: Blob | null; // null while the snapshots are being taken
  trim: SnapshotTrim;
}

const percent = (fraction: number): string => `${Number((fraction * 100).toFixed(4))}%`;

// Custom R3, R5: a snapshot cropped to its silhouette's trim. It fills its parent, which has the trim's aspect and clips: the whole square picture is
// scaled up so the trim box fills the parent and slid so the box lines up with it.
export function TrimmedImage({ blob, trim }: TrimmedImageProps): React.JSX.Element | null {
  const url = useObjectUrl(blob);
  if (url === null) return null;
  return <img src={url} alt="" draggable={false} className="setup-trimmed" style={{ width: percent(1 / trim.w), height: percent(1 / trim.h), left: percent(-trim.x / trim.w), top: percent(-trim.y / trim.h) }} />;
}
