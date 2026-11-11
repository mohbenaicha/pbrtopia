import type { PlanMap } from '@mat/generation';

/** Generation R11: what a map chip looks like in the row and on a card, a small picture of the kind of map; the name beside it says which. */
export function MapChipThumb({ map }: { map: PlanMap }): React.JSX.Element {
  return (
    <span className="setup-thumb-slot">
      <span className={`map-chip-thumb map-chip-thumb--${map}`} aria-hidden="true" />
    </span>
  );
}
