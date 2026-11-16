export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type CardSide = 'below' | 'above' | 'right' | 'left' | 'center';

export interface CardPlacement {
  left: number;
  top: number;
  side: CardSide;
  arrow: number; // along the card's edge facing the target: x for below and above, y for right and left
}

const MARGIN_PX = 8;
const GAP_PX = 14; // room for the arrow between the target's ring and the card
const ARROW_EDGE_PX = 18;

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), Math.max(low, high));

/** Where the card goes (tutorial R6): below the target when it fits, else above, else beside it, else centred without an arrow; always inside the window. */
export function placeCard(target: Box | null, card: { width: number; height: number }, win: { width: number; height: number }): CardPlacement {
  const centred: CardPlacement = { left: (win.width - card.width) / 2, top: (win.height - card.height) / 2, side: 'center', arrow: 0 };
  if (target === null) return centred;

  const centreX = target.left + target.width / 2;
  const centreY = target.top + target.height / 2;
  const fitsBelow = target.bottom + GAP_PX + card.height + MARGIN_PX <= win.height;
  const fitsAbove = target.top - GAP_PX - card.height - MARGIN_PX >= 0;
  const fitsRight = target.right + GAP_PX + card.width + MARGIN_PX <= win.width;
  const fitsLeft = target.left - GAP_PX - card.width - MARGIN_PX >= 0;

  if (fitsBelow || fitsAbove) {
    const left = clamp(centreX - card.width / 2, MARGIN_PX, win.width - card.width - MARGIN_PX);
    return { left, top: fitsBelow ? target.bottom + GAP_PX : target.top - GAP_PX - card.height, side: fitsBelow ? 'below' : 'above', arrow: clamp(centreX - left, ARROW_EDGE_PX, card.width - ARROW_EDGE_PX) };
  }
  if (fitsRight || fitsLeft) {
    const top = clamp(centreY - card.height / 2, MARGIN_PX, win.height - card.height - MARGIN_PX);
    return { left: fitsRight ? target.right + GAP_PX : target.left - GAP_PX - card.width, top, side: fitsRight ? 'right' : 'left', arrow: clamp(centreY - top, ARROW_EDGE_PX, card.height - ARROW_EDGE_PX) };
  }
  return centred;
}
