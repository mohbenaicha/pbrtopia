import { GROWTH, INSIDE } from './rasterizeIslandMask';
import { readTexelBilinear } from './readTexelBilinear';
import { fillFlatNormal, type IslandPiece, type PixelPicture, type UprightSheet } from './uprightTypes';

/**
 * normal-map R19: puts the normals made on the upright sheet back into the source albedo's layout. For each texel of each piece, the sheet position it was turned to is
 * sampled bilinearly, the x and y of the normal are turned back by the piece's turn (so a slope direction follows its feature), z is kept and the vector is re-encoded.
 * Texels of no piece are flat (128, 128, 255).
 */
export function unpackNormals(normals: PixelPicture, sheet: UprightSheet): PixelPicture {
  const side = sheet.picture.side;
  const rgba = new Uint8ClampedArray(side * side * 4);
  fillFlatNormal(rgba);
  const sample: [number, number, number] = [0, 0, 0];
  // The growth of every island first, then the texels inside triangles, so an island's own texels are never taken by a neighbour's growth (R19).
  for (const wanted of [GROWTH, INSIDE]) {
    for (const piece of sheet.pieces) writePiece(piece, wanted, normals, sheet.scale, rgba, side, sample);
  }
  return { side, rgba };
}

function writePiece(piece: IslandPiece, wanted: number, normals: PixelPicture, scale: number, rgba: Uint8ClampedArray, side: number, sample: [number, number, number]): void {
  const cos = Math.cos(piece.turnRad);
  const sin = Math.sin(piece.turnRad);
  const { source: from, sheet: spot } = piece;
  const backCos = cos; // the inverse turn: cos(-t) = cos t, sin(-t) = -sin t
  const backSin = -sin;
  for (let my = 0; my < from.height; my += 1) {
    for (let mx = 0; mx < from.width; mx += 1) {
      if (from.mask[my * from.width + mx] !== wanted) continue;
      const x = from.minX + mx;
      const y = from.minY + my;
      if (x < 0 || y < 0 || x >= side || y >= side) continue;
      const dx = x + 0.5 - from.centreX;
      const dy = y + 0.5 - from.centreY;
      const qx = dx * cos - dy * sin;
      const qy = dx * sin + dy * cos;
      readTexelBilinear(normals.rgba, normals.side, spot.x + (qx - spot.originX) * scale, spot.y + (qy - spot.originY) * scale, sample);
      const nx = (sample[0] / 255) * 2 - 1;
      const downY = -((sample[1] / 255) * 2 - 1); // y runs down the picture while turning
      const rx = nx * backCos - downY * backSin;
      const ry = nx * backSin + downY * backCos;
      const o = (y * side + x) * 4;
      rgba[o] = (rx * 0.5 + 0.5) * 255;
      rgba[o + 1] = (-ry * 0.5 + 0.5) * 255;
      rgba[o + 2] = sample[2];
    }
  }
}
