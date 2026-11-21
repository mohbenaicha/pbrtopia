import { MIN_SCALE, PIECE_GAP_PX, SCALE_STEP } from './uprightTypes';

export interface PieceBox {
  width: number; // the turned box, at scale 1
  height: number;
}

export interface PiecePlacement {
  x: number;
  y: number;
  width: number; // at the chosen scale
  height: number;
}

export interface Packing {
  scale: number;
  placements: PiecePlacement[]; // same order as the boxes given
}

function tryScale(boxes: readonly PieceBox[], order: readonly number[], side: number, scale: number): PiecePlacement[] | null {
  const placements: PiecePlacement[] = boxes.map(() => ({ x: 0, y: 0, width: 0, height: 0 }));
  let x = PIECE_GAP_PX;
  let y = PIECE_GAP_PX;
  let rowHeight = 0;
  for (const i of order) {
    const width = Math.ceil(boxes[i]!.width * scale);
    const height = Math.ceil(boxes[i]!.height * scale);
    if (x + width + PIECE_GAP_PX > side && x > PIECE_GAP_PX) {
      x = PIECE_GAP_PX;
      y += rowHeight + PIECE_GAP_PX;
      rowHeight = 0;
    }
    if (x + width + PIECE_GAP_PX > side || y + height + PIECE_GAP_PX > side) return null;
    placements[i] = { x, y, width, height };
    x += width + PIECE_GAP_PX;
    rowHeight = Math.max(rowHeight, height);
  }
  return placements;
}

/**
 * normal-map R17: rows filled left to right, tallest piece first, PIECE_GAP_PX between pieces and at the edges. One scale for all pieces,
 * the largest at most 1 (steps of SCALE_STEP down to MIN_SCALE) at which everything fits; null when none does.
 */
export function packPieces(boxes: readonly PieceBox[], side: number): Packing | null {
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[b]!.height - boxes[a]!.height || a - b);
  for (let step = 0; ; step += 1) {
    const scale = Math.round((1 - step * SCALE_STEP) * 100) / 100;
    if (scale < MIN_SCALE - 1e-9) return null;
    const placements = tryScale(boxes, order, side, scale);
    if (placements !== null) return { scale, placements };
  }
}
