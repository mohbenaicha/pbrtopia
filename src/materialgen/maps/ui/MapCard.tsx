import { MapHalf, type HalfContext } from './MapHalf';
import type { CardModel } from './buildCardModel';
import './MapCard.css';

interface MapCardProps extends Omit<HalfContext, 'busy'> {
  model: CardModel;
  /** True for each map that has an operation running (the card shows its busy state, maps R49). */
  isBusy(kind: CardModel['halves'][number]['kind']): boolean;
  /** Buttons the host adds to the overlay of a map's picture (the AO tool on the AO map), also shown while the map is empty. */
  extras?: Partial<Record<CardModel['halves'][number]['kind'], React.ReactNode>>;
  /** The guided tour's anchor for this card's buttons, when a step points at them (tutorial R22). */
  tutorial?: string | undefined;
}

/** Maps R42, R44, R47: a slot card, one cell of the maps grid (two columns, as the projection app's picture grids). A card with two maps (Metal-Roughness) shows both halves and one Undo for the pair. */
export function MapCard({ model, isBusy, extras, tutorial, ...context }: MapCardProps): React.JSX.Element {
  const split = model.halves.length > 1;
  const names = model.halves.map((half) => half.label);

  // A file dropped on the card outside a zone never reaches the browser's own handling, which would open the file in the tab.
  const isFileDrag = (event: React.DragEvent): boolean => Array.from(event.dataTransfer?.types ?? []).includes('Files');
  const cardDrop = (event: React.DragEvent): void => {
    if (event.defaultPrevented || !isFileDrag(event)) return; // a zone took it
    event.preventDefault();
    if (split) context.actions.refuseDrop(`Drop on ${names.join(' or ')}.`); // maps R42
    else context.actions.dropFiles(model.halves[0]!.kind, Array.from(event.dataTransfer.files));
  };
  return (
    <section
      className="map-card"
      aria-label={model.title}
      data-testid="slot-card"
      data-split={split ? '' : undefined}
      onDragOver={(event) => isFileDrag(event) && event.preventDefault()}
      onDrop={cardDrop}
    >
      <div className="map-card__halves">
        {model.halves.map((half) => (
          <MapHalf key={half.kind} half={half} {...context} busy={isBusy(half.kind)} extras={extras?.[half.kind]} undo={model.undo} {...(tutorial !== undefined && half === model.halves[0] ? { buttonsTutorial: tutorial } : {})} />
        ))}
      </div>

    </section>
  );
}
