import { BRUSH_ATLAS_URL } from '../atlas/loadBrushAtlas';
import { ATLAS_LAYOUT } from '../atlas/readBrushAtlas';

/** Compositing R5, R6: one shape of the atlas, cut out of the one atlas picture with a CSS background (no 200 separate pictures); Invert swaps black and white (R5a). */
export function ShapeThumbnail({ index, invert, size }: { index: number; invert: boolean; size: number }): React.JSX.Element {
  const { columns, cell, gutter, tile, width, height } = ATLAS_LAYOUT;
  const scale = size / tile;
  const column = index % columns;
  const row = Math.floor(index / columns);
  return (
    <span
      className="shape-thumbnail"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${BRUSH_ATLAS_URL})`,
        backgroundSize: `${width * scale}px ${height * scale}px`,
        backgroundPosition: `${-(column * cell + gutter) * scale}px ${-(row * cell + gutter) * scale}px`,
        filter: invert ? 'invert(1)' : 'none',
      }}
    />
  );
}
