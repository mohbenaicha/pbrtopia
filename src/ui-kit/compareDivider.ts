// The comparison divider's arithmetic (materialgen-prep R43): a position is a percentage of the picture area, 0 at its left edge.

export const DIVIDER_START = 50;

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

/** The percentage of the picture area under a pointer, clamped to the area; the middle for an area with no width. */
export function dividerPercentAt(clientX: number, area: { left: number; width: number }): number {
  if (area.width <= 0) return DIVIDER_START;
  return clampPercent(((clientX - area.left) / area.width) * 100);
}

/** The divider position after a key, or null when the key does not move it. */
export function stepDivider(value: number, key: string, shift: boolean): number | null {
  const step = shift ? 10 : 1;
  if (key === 'ArrowRight' || key === 'ArrowUp') return clampPercent(value + step);
  if (key === 'ArrowLeft' || key === 'ArrowDown') return clampPercent(value - step);
  if (key === 'Home') return 0;
  if (key === 'End') return 100;
  return null;
}
