import { useState } from 'react';

/** What the viewport's Mask display popover shares with the preview (preview R28, masks R55): the overlay switch, session-only and off at the start. */
export interface MaskView {
  overlay: boolean; // the mask overlay on the preview
  onOverlay(on: boolean): void;
  highlight: number | null; // masks R80: the label under the pointer in the controls, drawn alone
  onHighlight(label: number | null): void;
}

export function useMaskView(): MaskView {
  const [overlay, onOverlay] = useState(false);
  const [highlight, onHighlight] = useState<number | null>(null);
  return { overlay, onOverlay, highlight, onHighlight };
}
