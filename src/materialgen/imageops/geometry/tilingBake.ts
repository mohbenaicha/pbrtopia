// Imageops R37: whether the preview's tiling can be baked into the maps.

export interface TilingSettings {
  tx: number;
  ty: number;
  ox: number;
  oy: number;
}

export type TilingBakeState = { enabled: true } | { enabled: false; reason: string };

const isWholeRepeat = (value: number): boolean => Number.isInteger(value) && value >= 1 && value <= 10;

export function tilingBakeState({ tx, ty, ox, oy }: TilingSettings): TilingBakeState {
  if (!isWholeRepeat(tx) || !isWholeRepeat(ty)) return { enabled: false, reason: 'Set whole-number tiling' };
  if (tx === 1 && ty === 1 && ox === 0 && oy === 0) return { enabled: false, reason: 'Tiling is already 1 x 1.' };
  return { enabled: true };
}
