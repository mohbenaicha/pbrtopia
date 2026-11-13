import type { CSSProperties } from 'react';

const CORNER_OFFSET_PX = 20; // branding R1: inset from the window's bottom left
const MARK_OPACITY = 0.7;

const markStyle: CSSProperties = {
  position: 'fixed',
  left: CORNER_OFFSET_PX,
  bottom: CORNER_OFFSET_PX,
  opacity: MARK_OPACITY,
  height: 56,
  width: 'auto',
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: 'var(--layer-brand)', // above the floating panels, below every popover-blocking layer and dialog (viewport-layout R38)
};

/** Branding R1: the app's wide logo as a see-through mark in the window's bottom left corner. Decoration only: no clicks, no alt text. */
export function BrandMark({ src }: { src: string }) {
  return <img src={src} alt="" aria-hidden="true" draggable={false} style={markStyle} />;
}
