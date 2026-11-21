import type { RunError } from '../generateStore';
import type { Result } from '../providers/providerTypes';
import { findIslands } from './findIslands';
import { isUvInsidePicture } from './isUvInsidePicture';
import { measureUpTurn } from './measureUpTurn';
import { packPieces } from './packPieces';
import { rasterizeIslandMask, type IslandMask } from './rasterizeIslandMask';
import { readTexelBilinear } from './readTexelBilinear';
import { BLACK_SUM, EMPTY_ISLAND_SHARE, NO_BAKED_AREA, PIECE_PADDING_PX, SHEET_TOO_SMALL, UV_OUTSIDE_PICTURE, type IslandPiece, type PixelPicture, type UprightSheet, type UvMesh } from './uprightTypes';

const refuse = (message: string): Result<never, RunError> => ({ ok: false, error: { category: 'validation', retryable: false, message } });

/** normal-map R15: an island is empty when fewer than EMPTY_ISLAND_SHARE of its texels are non-black. */
export function isEmptyIsland(litTexels: number, totalTexels: number): boolean {
  return totalTexels === 0 || litTexels / totalTexels < EMPTY_ISLAND_SHARE;
}

function countLitTexels(source: PixelPicture, area: IslandMask): { lit: number; total: number } {
  let lit = 0;
  let total = 0;
  for (let y = 0; y < area.height; y += 1) {
    for (let x = 0; x < area.width; x += 1) {
      if (area.mask[y * area.width + x] === 0) continue;
      total += 1;
      const sx = area.minX + x;
      const sy = area.minY + y;
      if (sx < 0 || sy < 0 || sx >= source.side || sy >= source.side) continue;
      const o = (sy * source.side + sx) * 4;
      if (source.rgba[o]! + source.rgba[o + 1]! + source.rgba[o + 2]! > BLACK_SUM) lit += 1;
    }
  }
  return { lit, total };
}

interface TurnedBox {
  originX: number; // the box's corner in the turned frame around the island's centre
  originY: number;
  width: number;
  height: number;
}

// The box that holds every corner of the island once turned, grown by the padding (the padding is a distance, so turning keeps it).
function turnedBoxOf(area: IslandMask, centreX: number, centreY: number, turn: number): TurnedBox {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < area.points.length; i += 2) {
    const dx = area.points[i]! - centreX;
    const dy = area.points[i + 1]! - centreY;
    const x = dx * cos - dy * sin;
    const y = dx * sin + dy * cos;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const originX = Math.floor(minX) - PIECE_PADDING_PX;
  const originY = Math.floor(minY) - PIECE_PADDING_PX;
  return { originX, originY, width: Math.ceil(maxX) + PIECE_PADDING_PX - originX, height: Math.ceil(maxY) + PIECE_PADDING_PX - originY };
}

/**
 * normal-map R15-R17: turns every island of the albedo upright (world up = picture up) and packs the turned islands on a black square sheet of the albedo's side.
 * Refuses, before any call is made, a model with no baked island and a model whose islands do not fit the sheet.
 */
export function buildUprightSheet(source: PixelPicture, mesh: UvMesh): Result<UprightSheet, RunError> {
  const side = source.side;
  if (!isUvInsidePicture(mesh)) return refuse(UV_OUTSIDE_PICTURE);
  const pieces: Omit<IslandPiece, 'sheet'>[] = [];
  const boxes: TurnedBox[] = [];
  findIslands(mesh).forEach((triangles, index) => {
    const area = rasterizeIslandMask(mesh, triangles, side);
    const { lit, total } = countLitTexels(source, area);
    if (isEmptyIsland(lit, total)) return;
    const turnRad = measureUpTurn(mesh, triangles);
    const centreX = area.minX + area.width / 2;
    const centreY = area.minY + area.height / 2;
    boxes.push(turnedBoxOf(area, centreX, centreY, turnRad));
    pieces.push({ index, turnRad, triangles: triangles.length, source: { minX: area.minX, minY: area.minY, width: area.width, height: area.height, centreX, centreY, mask: area.mask } });
  });
  if (pieces.length === 0) return refuse(NO_BAKED_AREA);

  const packing = packPieces(boxes, side);
  if (packing === null) return refuse(SHEET_TOO_SMALL);

  const placed: IslandPiece[] = pieces.map((piece, i) => {
    const box = boxes[i]!;
    const spot = packing.placements[i]!;
    return { ...piece, sheet: { x: spot.x, y: spot.y, width: spot.width, height: spot.height, originX: box.originX, originY: box.originY } };
  });

  const rgba = new Uint8ClampedArray(side * side * 4);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  const mask = new Uint8Array(side * side);
  const colour: [number, number, number] = [0, 0, 0];
  for (const piece of placed) {
    const cos = Math.cos(piece.turnRad);
    const sin = Math.sin(piece.turnRad);
    const { source: from, sheet } = piece;
    for (let yy = 0; yy < sheet.height; yy += 1) {
      for (let xx = 0; xx < sheet.width; xx += 1) {
        const qx = sheet.originX + (xx + 0.5) / packing.scale; // the turned frame
        const qy = sheet.originY + (yy + 0.5) / packing.scale;
        const sx = from.centreX + qx * cos + qy * sin; // back to the source: the inverse turn
        const sy = from.centreY - qx * sin + qy * cos;
        const mx = Math.floor(sx - from.minX);
        const my = Math.floor(sy - from.minY);
        if (mx < 0 || my < 0 || mx >= from.width || my >= from.height || from.mask[my * from.width + mx] === 0) continue;
        const ox = sheet.x + xx;
        const oy = sheet.y + yy;
        if (ox >= side || oy >= side) continue;
        readTexelBilinear(source.rgba, side, sx, sy, colour);
        rgba.set([colour[0], colour[1], colour[2]], (oy * side + ox) * 4);
        mask[oy * side + ox] = 1;
      }
    }
  }
  return { ok: true, value: { picture: { side, rgba }, pieces: placed, scale: packing.scale, mask } };
}
