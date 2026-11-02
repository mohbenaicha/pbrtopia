import type { SnapshotTrim } from '../../custom/sheetPreview';
import { TrimmedImage } from './TrimmedImage';

interface CameraThumbProps {
  blob: Blob | null; // null while the snapshots are being taken
  trim: SnapshotTrim | null; // null until the silhouettes are measured: the whole square is shown
}

const WHOLE_FRAME: SnapshotTrim = { x: 0, y: 0, w: 1, h: 1 };

// Custom R3: a camera's snapshot, small, cut to its silhouette and at the cut's own aspect inside a square slot. The caption beside it names the camera, so the picture itself is decorative.
export function CameraThumb({ blob, trim }: CameraThumbProps): React.JSX.Element {
  const shown = trim ?? WHOLE_FRAME;
  return (
    <span className="setup-thumb-slot">
      <span className="setup-thumb" style={{ '--trim-aspect': String(shown.w / shown.h) } as React.CSSProperties}>
        <TrimmedImage blob={blob} trim={shown} />
      </span>
    </span>
  );
}
