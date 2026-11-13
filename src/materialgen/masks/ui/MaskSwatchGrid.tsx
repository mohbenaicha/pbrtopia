import type { CSSProperties } from 'react';
import type { MaskRow } from '../record/maskRows';
import type { PaletteEntry } from '../record/masksRecord';
import './masksPanel.css';

interface MaskSwatchGridProps {
  rows: readonly MaskRow[];
  palette: readonly PaletteEntry[];
  /** The selected components' labels (masks R89: several can be selected). */
  selected: readonly number[];
  onSelect(label: number): void;
  /** Masks R80: the pointer is over a swatch, or one has the focus (its label), or neither (null). */
  onHighlight?(label: number | null): void;
  /** The line above the grid; the popover's by default (the filter dialog says what a selection does there, imageops R78). */
  hint?: string;
}

const COLUMNS = 5; // one row up to five components, two rows up to ten (masks R48)

/** Masks R48, R57: the hint line and one colour swatch per component in label order; a swatch is a toggle button named by its component. */
export function MaskSwatchGrid({ rows, palette, selected, onSelect, onHighlight, hint = 'Select a material to edit its properties' }: MaskSwatchGridProps): React.JSX.Element {
  const colourOf = (label: number): string => palette.find((entry) => entry.label === label)?.hex ?? 'var(--bg-input)';
  return (
    <>
      <p className="mask-swatches__hint">{hint}</p>
      <div className="mask-swatches" style={{ '--mask-swatch-columns': COLUMNS } as CSSProperties}>
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            className="mask-swatch"
            aria-label={row.name}
            aria-pressed={selected.includes(row.label)}
            title={row.description === '' ? row.name : `${row.name}: ${row.description}`}
            style={{ backgroundColor: colourOf(row.label) }}
            onClick={() => onSelect(row.label)}
            onPointerEnter={() => onHighlight?.(row.label)}
            onPointerLeave={() => onHighlight?.(null)}
            onFocus={() => onHighlight?.(row.label)}
            onBlur={() => onHighlight?.(null)}
          />
        ))}
      </div>
    </>
  );
}
