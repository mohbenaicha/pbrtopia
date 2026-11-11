import { useState } from 'react';

/** What the viewport's Material Masks icon and the Material Masks section of the right panel share (preview R28, masks R55): both are session-only, off at the start. */
export interface MaskView {
  overlay: boolean; // the mask overlay on the preview
  onOverlay(on: boolean): void;
  open: boolean; // the Material Masks section is open
  onOpenChange(open: boolean): void;
}

export function useMaskView(): MaskView {
  const [overlay, onOverlay] = useState(false);
  const [open, onOpenChange] = useState(false);
  return { overlay, onOverlay, open, onOpenChange };
}
