import { Icon, IconButton } from '@shared/ui-kit';
import type { Palette, ShapeSlotNumber } from '../session/palette';
import { ShapeThumbnail } from './ShapeThumbnail';

interface PaletteSwatchesProps {
  palette: Palette;
  onPickShape: (slot: ShapeSlotNumber) => void;
  onRemoveShape: (slot: ShapeSlotNumber) => void;
  onToggleInvert: (slot: ShapeSlotNumber) => void;
  onPickMaterial: () => void;
  onRemoveMaterial: () => void;
}

const SLOTS: readonly ShapeSlotNumber[] = [0, 1, 2];
const SWATCH_PIXELS = 56;

const emptySlot = (label: string, onClick: () => void): React.JSX.Element => (
  <button type="button" className="reference-strip__add" aria-label={`Add ${label.toLowerCase()}`} title={`Add ${label.toLowerCase()}`} onClick={onClick}>
    <Icon name="plus" size={18} />
  </button>
);

/**
 * Compositing R5: Shape 1, Shape 2, Shape 3 and Material, styled as the reference strip under the Generate text input: an empty slot is a plus square, a filled
 * one its thumbnail with a remove mark at the top right; a filled shape also has Invert at the bottom right.
 */
export function PaletteSwatches({ palette, onPickShape, onRemoveShape, onToggleInvert, onPickMaterial, onRemoveMaterial }: PaletteSwatchesProps): React.JSX.Element {
  const material = palette.material;
  return (
    <div className="reference-strip palette-swatches">
      <ul className="reference-strip__list">
        {SLOTS.map((slot) => {
          const shape = palette.shapes[slot];
          const name = `Shape ${slot + 1}`;
          return (
            <li key={slot} className="reference-strip__item" data-testid={`palette-shape-${slot + 1}`}>
              {shape === null ? (
                emptySlot(name, () => onPickShape(slot))
              ) : (
                <>
                  <button type="button" className="reference-strip__thumb palette-swatches__thumb" aria-label={`Change ${name.toLowerCase()}`} title={name} onClick={() => onPickShape(slot)}>
                    <ShapeThumbnail index={shape.index} invert={shape.invert} size={SWATCH_PIXELS - 2} />
                  </button>
                  <span className="reference-strip__remove">
                    <IconButton compact label={`Remove shape ${slot + 1}`} icon={<Icon name="close" size={10} />} onClick={() => onRemoveShape(slot)} />
                  </span>
                  <span className="palette-swatches__invert">
                    <IconButton compact label={`Invert shape ${slot + 1}`} hint="Swap black and white" pressed={shape.invert} icon={<Icon name="invert" size={12} />} onClick={() => onToggleInvert(slot)} />
                  </span>
                </>
              )}
            </li>
          );
        })}
        <li className="reference-strip__item" data-testid="palette-material">
          {material === null ? (
            emptySlot('Material', onPickMaterial)
          ) : (
            <>
              <button type="button" className="reference-strip__thumb palette-swatches__thumb" aria-label="Change material" title={material.name} onClick={onPickMaterial}>
                <span
                  className="palette-swatches__ball"
                  style={{ background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.75), rgba(255,255,255,0) 42%), rgb(${material.rgb.join(',')})`, opacity: 1 - material.roughness * 0.25 }}
                />
              </button>
              <span className="reference-strip__remove">
                <IconButton compact label="Remove material" icon={<Icon name="close" size={10} />} onClick={onRemoveMaterial} />
              </span>
            </>
          )}
        </li>
      </ul>
    </div>
  );
}
