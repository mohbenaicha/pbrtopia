// Imageops R29: the crop rectangle a session holds, trimmed edge by edge in pixels of the S x S working copy.

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropEdge = 'top' | 'left' | 'right' | 'bottom';

export const MIN_CROP_SIDE = 16; // a click that would leave less on either axis is ignored (proposal in the spec)
export const DEFAULT_CROP_AMOUNT = 8;

export const fullRect = (size: number): CropRect => ({ x: 0, y: 0, width: size, height: size });

export const isFullRect = (rect: CropRect, size: number): boolean => rect.x === 0 && rect.y === 0 && rect.width === size && rect.height === size;

const wholeAmount = (amount: number): number => (Number.isFinite(amount) ? Math.max(1, Math.floor(amount)) : 1);

/** The rectangle after removing `amount` pixels (at least 1) from one edge; the same rectangle when too little would remain. */
export function trimEdge(rect: CropRect, edge: CropEdge, amount: number): CropRect {
  const by = wholeAmount(amount);
  const horizontal = edge === 'left' || edge === 'right';
  if ((horizontal ? rect.width : rect.height) - by < MIN_CROP_SIDE) return rect;
  switch (edge) {
    case 'top': return { ...rect, y: rect.y + by, height: rect.height - by };
    case 'left': return { ...rect, x: rect.x + by, width: rect.width - by };
    case 'right': return { ...rect, width: rect.width - by };
    case 'bottom': return { ...rect, height: rect.height - by };
  }
}

export const describeCrop = (rect: CropRect, size: number): string => `${rect.width} x ${rect.height} px, scaled to ${size} x ${size}`;
