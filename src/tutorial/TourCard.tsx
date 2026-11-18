import { forwardRef, useEffect, useId } from 'react';
import { Button } from '../ui-kit';
import { renderInlineMarkup } from './inlineMarkup';
import type { CardPlacement } from './placeCard';
import type { TourSnapshot } from './tourTypes';

/** One size for every step, so the card never resizes as the tour moves; a long text scrolls inside (tutorial R6). */
export const CARD_WIDTH_PX = 380;
export const CARD_HEIGHT_PX = 290;

interface TourCardProps {
  snapshot: TourSnapshot;
  placement: CardPlacement;
  onNext: () => void;
  onPrevious: () => void;
  onExit: () => void;
}

/** The card in the tooltip's look with Exit, Previous and Next (tutorial R6, R12). */
export const TourCard = forwardRef<HTMLDivElement, TourCardProps>(function TourCard({ snapshot, placement, onNext, onPrevious, onExit }, ref) {
  const id = useId();
  const last = snapshot.index === snapshot.total - 1;
  useEffect(() => {
    if (ref !== null && typeof ref !== 'function') ref.current?.focus({ preventScroll: true });
  }, [ref, snapshot.index]);
  return (
    <div
      ref={ref}
      className="tour-card"
      role="dialog"
      aria-labelledby={`${id}-heading`}
      aria-describedby={`${id}-words`}
      tabIndex={-1}
      data-side={placement.side}
      style={{ width: CARD_WIDTH_PX, height: CARD_HEIGHT_PX, left: placement.left, top: placement.top, ['--tour-arrow' as string]: `${placement.arrow}px` }}
    >
      <div className="tour-card__meta">
        <span>{snapshot.sectionTitle}</span>
        <span>{`${snapshot.index + 1} / ${snapshot.total}`}</span>
      </div>
      <p id={`${id}-heading`} className="tour-card__heading">{snapshot.heading}</p>
      <div id={`${id}-words`} className="tour-card__body" aria-live="polite">
        {snapshot.paragraphs.map((paragraph, index) => (
          <p key={index}>{renderInlineMarkup(paragraph)}</p>
        ))}
      </div>
      <div className="tour-card__actions">
        <Button variant="ghost" onClick={onExit}>Exit</Button>
        <span className="tour-card__spacer" />
        <Button disabled={snapshot.index === 0} onClick={onPrevious}>Previous</Button>
        <Button variant="primary" onClick={onNext}>{last ? 'Done' : 'Next'}</Button>
      </div>
    </div>
  );
});
