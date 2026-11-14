import { ATLAS_LAYOUT } from '../atlas/readBrushAtlas';
import { PickerOverlay } from './PickerOverlay';
import { ShapeThumbnail } from './ShapeThumbnail';

interface ShapePickerProps {
  /** Shapes already in another slot: marked, still choosable (R6). */
  taken: readonly number[];
  onChoose: (index: number) => void;
  onClose: () => void;
}

const TILE_PIXELS = 64;

/** Compositing R6: every shape of the atlas as a tile grid; a click fills the slot that opened the overlay and closes it. */
export function ShapePicker({ taken, onChoose, onClose }: ShapePickerProps): React.JSX.Element {
  const count = ATLAS_LAYOUT.columns * ATLAS_LAYOUT.rows;
  return (
    <PickerOverlay title="Choose a shape" onClose={onClose}>
      <ul className="shape-picker" aria-label="Shapes">
        {Array.from({ length: count }, (_, index) => (
          <li key={index}>
            <button type="button" className={`shape-picker__tile${taken.includes(index) ? ' shape-picker__tile--taken' : ''}`} aria-label={`Shape ${index + 1}${taken.includes(index) ? ' (already used)' : ''}`} onClick={() => onChoose(index)}>
              <ShapeThumbnail index={index} invert={false} size={TILE_PIXELS} />
            </button>
          </li>
        ))}
      </ul>
    </PickerOverlay>
  );
}
