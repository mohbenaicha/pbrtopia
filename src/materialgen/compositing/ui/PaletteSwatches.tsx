import { Icon, IconButton } from '@shared/ui-kit';
import type { Palette, ShapeSlotNumber } from '../session/palette';
import { MaterialBall } from './MaterialBall';
import { PaintTip } from './PaintTip';
import { ShapeThumbnail } from './ShapeThumbnail';

interface PaletteSwatchesProps {
  palette: Palette;
  onPickShape: (slot: ShapeSlotNumber) => void;
  onToggleShapeActive: (slot: ShapeSlotNumber) => void;
  onRemoveShape: (slot: ShapeSlotNumber) => void;
  onToggleInvert: (slot: ShapeSlotNumber) => void;
  onPickMaterial: () => void;
  onRemoveMaterial: () => void;
}

const SLOTS: readonly ShapeSlotNumber[] = [0, 1, 2];
const SWATCH_PIXELS = 56;
const BALL_PIXELS = 44;
const SPHERE_HIGHLIGHT = 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.75), rgba(255,255,255,0) 42%)';

const emptySlot = (label: string, onClick: () => void): React.JSX.Element => (
  <PaintTip tip="shape" layout="fill">
    <button type="button" className="reference-strip__add" aria-label={`Add ${label.toLowerCase()}`} onClick={onClick}>
      <Icon name="plus" size={18} />
    </button>
  </PaintTip>
);

/**
 * Compositing R5, R42, R57: Material, Shape 1, Shape 2 and Shape 3, styled as the reference strip under the Generate text input. An empty shape slot is a plus square,
 * a filled one its thumbnail (a toggle: outlined while active) with a remove mark at the top right (a filled shape also has Invert at the bottom right). An empty Material slot is the plain grey
 * sphere of the default material; a chosen material replaces it and gets the remove mark.
 */
export function PaletteSwatches({ palette, onPickShape, onToggleShapeActive, onRemoveShape, onToggleInvert, onPickMaterial, onRemoveMaterial }: PaletteSwatchesProps): React.JSX.Element {
  const material = palette.material;
  return (
    <div className="reference-strip palette-swatches">
      <ul className="reference-strip__list">
        <li className="reference-strip__item" data-testid="palette-material">
          {material === null ? (
            <PaintTip tip="material" layout="fill">
              <button type="button" className="reference-strip__thumb palette-swatches__thumb" aria-label="Choose material" onClick={onPickMaterial}>
                <span className="palette-swatches__ball palette-swatches__ball--default" style={{ background: `${SPHERE_HIGHLIGHT}, rgb(128,128,128)` }} />
              </button>
            </PaintTip>
          ) : (
            <>
              <PaintTip tip="material" layout="fill">
                <button type="button" className="reference-strip__thumb palette-swatches__thumb" aria-label="Change material" onClick={onPickMaterial}>
                  <MaterialBall material={material} size={BALL_PIXELS} />
                </button>
              </PaintTip>
              <span className="reference-strip__remove">
                <IconButton compact label="Remove material" icon={<Icon name="close" size={10} />} onClick={onRemoveMaterial} />
              </span>
            </>
          )}
        </li>
        {SLOTS.map((slot) => {
          const shape = palette.shapes[slot];
          const name = `Shape ${slot + 1}`;
          return (
            <li key={slot} className="reference-strip__item" data-testid={`palette-shape-${slot + 1}`}>
              {shape === null ? (
                emptySlot(name, () => onPickShape(slot))
              ) : (
                <>
                  <PaintTip tip="shape" layout="fill">
                    <button type="button" className="reference-strip__thumb palette-swatches__thumb" aria-label={`Use ${name.toLowerCase()}`} aria-pressed={palette.active[slot]} onClick={() => onToggleShapeActive(slot)}>
                      <ShapeThumbnail index={shape.index} invert={shape.invert} size={SWATCH_PIXELS - 2} />
                    </button>
                  </PaintTip>
                  <span className="reference-strip__remove">
                    <IconButton compact label={`Remove shape ${slot + 1}`} icon={<Icon name="close" size={10} />} onClick={() => onRemoveShape(slot)} />
                  </span>
                  <span className="palette-swatches__invert">
                    <PaintTip tip="invert" layout="inline">
                      <IconButton compact untitled label={`Invert shape ${slot + 1}`} pressed={shape.invert} icon={<Icon name="invert" size={12} />} onClick={() => onToggleInvert(slot)} />
                    </PaintTip>
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
