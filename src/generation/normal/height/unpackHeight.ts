import type { IslandPiece, PixelPicture, UprightSheet } from '../uprightTypes';
import { sampleFloatBilinear } from './sampleFloatBilinear';

/**
 * normal-height-edit R1: puts the height of the upright sheet (luma 0 to 1, at the sheet's side) back into the source albedo's layout. For each texel an island owns, the
 * sheet position it was turned to is sampled bilinearly (a height is a scalar: no rotation) and rounded to 8 bits. Texels of no island, and of an island the sheet left out
 * as empty, are 0. Result: grey RGBA, alpha 255, at the albedo's side.
 */
export function unpackHeight(sheetHeight: Float32Array, sheet: UprightSheet, owner: Uint16Array): PixelPicture {
  const side = sheet.picture.side;
  const rgba = new Uint8ClampedArray(side * side * 4);
  for (let i = 0; i < side * side; i += 1) rgba[i * 4 + 3] = 255;
  for (const piece of sheet.pieces) writePiece(piece, sheetHeight, sheet.scale, owner, rgba, side);
  return { side, rgba };
}

function writePiece(piece: IslandPiece, sheetHeight: Float32Array, scale: number, owner: Uint16Array, rgba: Uint8ClampedArray, side: number): void {
  const cos = Math.cos(piece.turnRad);
  const sin = Math.sin(piece.turnRad);
  const { source: from, sheet: spot } = piece;
  const mine = piece.index + 1;
  for (let my = 0; my < from.height; my += 1) {
    for (let mx = 0; mx < from.width; mx += 1) {
      if (from.mask[my * from.width + mx] === 0) continue;
      const x = from.minX + mx;
      const y = from.minY + my;
      if (x < 0 || y < 0 || x >= side || y >= side || owner[y * side + x] !== mine) continue;
      const dx = x + 0.5 - from.centreX;
      const dy = y + 0.5 - from.centreY;
      const qx = dx * cos - dy * sin;
      const qy = dx * sin + dy * cos;
      const level = Math.round(Math.min(1, Math.max(0, sampleFloatBilinear(sheetHeight, side, spot.x + (qx - spot.originX) * scale, spot.y + (qy - spot.originY) * scale))) * 255);
      const o = (y * side + x) * 4;
      rgba[o] = level;
      rgba[o + 1] = level;
      rgba[o + 2] = level;
    }
  }
}
