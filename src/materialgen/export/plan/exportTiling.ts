/** Export R48 (proposal): the most pixels a tiled picture has on a side. 8192 x 8192 x 3 bytes is 192 MB, what the worker holds comfortably (R50). */
export const MAX_TILED_SIDE = 8192;

export interface BakedTiling {
  x: number;
  y: number;
}

const TOO_LARGE = 'Too large: lower the size or the tiling.';

/** Export R48: why a tiling cannot be baked at this size, or null when it fits. */
export function tilingBlockReason(size: number, x: number, y: number): string | null {
  return size * x > MAX_TILED_SIDE || size * y > MAX_TILED_SIDE ? TOO_LARGE : null;
}

/**
 * Export R45-R48: the tiling the export writes into its pictures, or null when it writes none: the switch is off, the tiling is 1 x 1 (nothing to
 * repeat) or the result would not fit. Otherwise the project's tiling as it is.
 */
export function bakedTilingOf({ on, size, x, y }: { on: boolean; size: number; x: number; y: number }): BakedTiling | null {
  if (!on || x * y <= 1 || tilingBlockReason(size, x, y) !== null) return null;
  return { x, y };
}
