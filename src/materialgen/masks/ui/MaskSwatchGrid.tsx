import type { CSSProperties } from 'react';
import type { MaskRow } from '../record/maskRows';
import type { PaletteEntry } from '../record/masksRecord';
import './masksPanel.css';

interface MaskSwatchGridProps {
  rows: readonly MaskRow[];
  palette: readonly PaletteEntry[];
  /** The selected component's label, or null when none is. */
  selected: number | null;
  onSelect(label: number): void;
}

const COLUMNS = 5; // one row up to five components, two rows up to ten (masks R48)

/** Masks R48, R57: the hint line and one colour swatch per component in label order; a swatch is a toggle button named by its component. */
export function MaskSwatchGrid({ rows, palette, selected, onSelect }: MaskSwatchGridProps): React.JSX.Element {
  const colourOf = (label: number): string => palette.find((entry) => entry.label === label)?.hex ?? 'var(--bg-input)';
  return (
    <>
      <p className="mask-swatches__hint">Select a material to edit its properties</p>
      <div className="mask-swatches" style={{ '--mask-swatch-columns': COLUMNS } as CSSProperties}>
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            className="mask-swatch"
            aria-label={row.name}
            aria-pressed={row.label === selected}
            title={row.description === '' ? row.name : `${row.name}: ${row.description}`}
            style={{ backgroundColor: colourOf(row.label) }}
            onClick={() => onSelect(row.label)}
          />
        ))}
      </div>
    </>
  );
}
