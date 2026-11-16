import type { CSSProperties } from 'react';
import { Icon } from '../ui-kit';
import './brandMark.css';

const CORNER_OFFSET_PX = 20; // branding R1: inset from the window's bottom left
const MARK_OPACITY = 0.7;
const GITHUB_ICON_PX = 30;
const MARK_GAP_PX = 14;

const rowStyle: CSSProperties = {
  position: 'fixed',
  left: CORNER_OFFSET_PX,
  bottom: CORNER_OFFSET_PX,
  display: 'flex',
  alignItems: 'center',
  gap: MARK_GAP_PX,
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: 'var(--layer-brand)', // above the floating panels, below every popover-blocking layer and dialog (viewport-layout R38)
};

const logoStyle: CSSProperties = { opacity: MARK_OPACITY, height: 56, width: 'auto' };

// The one part of the corner that takes clicks (branding R5). Its opacity comes from brandMark.css so hover can raise it.
const linkStyle: CSSProperties = { pointerEvents: 'auto', color: 'var(--text)', display: 'inline-flex', lineHeight: 0 };

interface BrandLink {
  href: string;
  label: string;
}

/**
 * Branding R1: the app's wide logo as a see-through mark in the window's bottom left corner. Decoration only: no clicks, no alt text.
 * Branding R5: an app may add a GitHub icon link beside it (white disc, the mascot cut out so what is behind shows through, same see-through level as the logo).
 */
export function BrandMark({ src, link }: { src: string; link?: BrandLink }) {
  return (
    <div style={rowStyle}>
      <img src={src} alt="" aria-hidden="true" draggable={false} style={logoStyle} />
      {link !== undefined && (
        <a className="brand-link" href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label} title={link.label} style={linkStyle}>
          <Icon name="github" size={GITHUB_ICON_PX} />
        </a>
      )}
    </div>
  );
}
