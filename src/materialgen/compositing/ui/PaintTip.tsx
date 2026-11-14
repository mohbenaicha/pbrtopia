import { Tooltip } from '@shared/ui-kit';
import type { ReactNode } from 'react';
import { PAINT_TOOLTIPS, type PaintTooltipKey } from './paintTooltips';

interface PaintTipProps {
  tip: PaintTooltipKey;
  /** row: a full-width line (a slider or switch row); inline: as big as its content; fill: as big as the box it sits in (a swatch). */
  layout?: 'row' | 'inline' | 'fill';
  children: ReactNode;
}

/** Compositing R49: the paint panel's tooltip for one control, its words taken from `PAINT_TOOLTIPS`. The wrapper is the hover target, so a disabled control still shows it. */
export function PaintTip({ tip, layout = 'row', children }: PaintTipProps): React.JSX.Element {
  const words = PAINT_TOOLTIPS[tip];
  return (
    <Tooltip heading={words.heading} text={words.text}>
      <span className="paint-tip" data-layout={layout}>{children}</span>
    </Tooltip>
  );
}
