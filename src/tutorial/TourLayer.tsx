import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TourController } from './TourController';
import { CARD_HEIGHT_PX, CARD_WIDTH_PX, TourCard } from './TourCard';
import { placeCard, type Box } from './placeCard';
import { SPOTLIGHT_PADDING_PX, TourSpotlight } from './TourSpotlight';
import { useAnchorRect } from './useAnchorRect';
import { useTour } from './useTour';
import { useTourKeys } from './useTourKeys';
import './tour.css';

function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const onResize = (): void => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

const padded = (box: Box): Box => ({ left: box.left - SPOTLIGHT_PADDING_PX, top: box.top - SPOTLIGHT_PADDING_PX, right: box.right + SPOTLIGHT_PADDING_PX, bottom: box.bottom + SPOTLIGHT_PADDING_PX, width: box.width + SPOTLIGHT_PADDING_PX * 2, height: box.height + SPOTLIGHT_PADDING_PX * 2 });

/**
 * The tour on screen (tutorial R5-R7): the veil with its hole and marching ring over the step's target, and the card. Mounted once at the app's root; draws nothing
 * until the tour starts, and hands focus back to what had it when the tour ends.
 */
export function TourLayer({ controller }: { controller: TourController }): React.JSX.Element | null {
  const snapshot = useTour(controller);
  const card = useRef<HTMLDivElement>(null);
  const before = useRef<Element | null>(null);
  const size = useWindowSize();
  const box = useAnchorRect(snapshot.phase === 'showing' ? snapshot.target : null, snapshot.step?.anchor);

  useTourKeys(snapshot.active, { next: () => controller.next(), previous: () => controller.previous(), exit: () => controller.exit(), card });

  useEffect(() => {
    if (!snapshot.active) return;
    before.current = document.activeElement;
    return () => {
      if (before.current instanceof HTMLElement) before.current.focus({ preventScroll: true });
      before.current = null;
    };
  }, [snapshot.active]);

  if (!snapshot.active) return null;
  const showing = snapshot.phase === 'showing';
  const placement = placeCard(box === null ? null : padded(box), { width: CARD_WIDTH_PX, height: CARD_HEIGHT_PX }, size);
  return createPortal(
    <div className="tour-layer">
      {showing && box !== null ? <TourSpotlight box={box} /> : <div className="tour-veil" aria-hidden="true" />}
      {showing && (
        <TourCard
          ref={card}
          snapshot={snapshot}
          placement={placement}
          onNext={() => controller.next()}
          onPrevious={() => controller.previous()}
          onExit={() => controller.exit()}
        />
      )}
    </div>,
    document.body,
  );
}
