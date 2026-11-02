import type { SheetPreview, SnapshotTrim } from '../../custom/sheetPreview';
import { TrimmedImage } from './TrimmedImage';

interface SheetPreviewCanvasProps {
  preview: SheetPreview;
  snapshots: Blob[] | null;
  trims: SnapshotTrim[] | null;
}

const WHOLE_FRAME: SnapshotTrim = { x: 0, y: 0, w: 1, h: 1 };
const percent = (fraction: number): string => `${Number((fraction * 100).toFixed(4))}%`;

// Custom R5: the canvas of a sheet at its real aspect, as large as the drop area allows, with each perspective cropped and placed where the run will put it.
// An aux tile (no camera) is a plain square: the aux views are chosen when the run starts.
export function SheetPreviewCanvas({ preview, snapshots, trims }: SheetPreviewCanvasProps): React.JSX.Element {
  return (
    <div className="setup-canvas" data-testid="sheet-preview" style={{ '--drop-aspect': String(preview.aspect) } as React.CSSProperties}>
      {preview.tiles.map((tile, index) => {
        const placement = { left: percent(tile.x), top: percent(tile.y), width: percent(tile.w), height: percent(tile.h) };
        return tile.camera === null ? (
          <span key={index} className="setup-canvas__tile setup-canvas__tile--aux" data-aux-tile style={placement} />
        ) : (
          <span key={tile.camera} className="setup-canvas__tile" data-camera={tile.camera} style={placement}>
            <TrimmedImage blob={snapshots?.[tile.camera] ?? null} trim={trims?.[tile.camera] ?? WHOLE_FRAME} />
          </span>
        );
      })}
    </div>
  );
}
