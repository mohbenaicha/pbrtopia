import { useState } from 'react';

/** What the viewport's Mask display popover shares with the preview (preview R28, masks R55): the overlay switch, session-only and off at the start. */
export interface MaskView {
  overlay: boolean; // the mask overlay on the preview
  onOverlay(on: boolean): void;
}

export function useMaskView(): MaskView {
  const [overlay, onOverlay] = useState(false);
  return { overlay, onOverlay };
}
