export type PanelSide = 'left' | 'right';

export interface PanelWidths {
  left: number;
  right: number;
}

interface PanelRange {
  min: number;
  max: number;
  default: number;
}

const RANGES: Record<PanelSide, PanelRange> = {
  left: { min: 220, max: 520, default: 296 },
  right: { min: 240, max: 560, default: 288 },
};

const MIN_VIEWPORT_PX = 360;
export const PANEL_GAPS_PX = 8; // the two gaps between the panels and the viewport (--space-1 each)

export const DEFAULT_PANEL_WIDTHS: PanelWidths = { left: RANGES.left.default, right: RANGES.right.default };

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const other = (side: PanelSide): PanelSide => (side === 'left' ? 'right' : 'left');

/** The widths a panel can have right now: its own range, cut short where the viewport would get narrower than 360 px; never below its minimum. */
export function panelLimits(side: PanelSide, widths: PanelWidths, windowWidth: number): { min: number; max: number } {
  const range = RANGES[side];
  const room = windowWidth - PANEL_GAPS_PX - MIN_VIEWPORT_PX - widths[other(side)];
  return { min: range.min, max: Math.max(range.min, Math.min(range.max, room)) };
}

/** Sets one panel to a wanted width within its limits; the other panel stays as it is. */
export function resizePanel(widths: PanelWidths, side: PanelSide, wantedPx: number, windowWidth: number): PanelWidths {
  const { min, max } = panelLimits(side, widths, windowWidth);
  return { ...widths, [side]: clamp(Number.isFinite(wantedPx) ? wantedPx : RANGES[side].default, min, max) };
}

/** Saved or current widths made valid for this window: each in its range, then the right panel and after it the left shrink until the viewport has its 360 px. */
export function clampPanelWidths(widths: PanelWidths, windowWidth: number): PanelWidths {
  const read = (side: PanelSide): number => clamp(Number.isFinite(widths[side]) ? widths[side] : RANGES[side].default, RANGES[side].min, RANGES[side].max);
  let left = read('left');
  let right = read('right');
  let overflow = left + right - (windowWidth - PANEL_GAPS_PX - MIN_VIEWPORT_PX);
  if (overflow > 0) {
    const fromRight = Math.min(overflow, right - RANGES.right.min);
    right -= fromRight;
    overflow -= fromRight;
    left -= Math.min(overflow, left - RANGES.left.min);
  }
  return { left, right };
}
