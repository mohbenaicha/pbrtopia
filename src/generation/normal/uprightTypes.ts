// normal-map R15-R20, contracts.md: the plain shapes and constants of the upright-island height route. No DOM, no store.

export interface UvMesh {
  positions: Float32Array; // 3 floats per vertex, model space (+Y is up)
  uvs: Float32Array; // 2 floats per vertex, origin top-left, v down (glTF)
  indices: Uint32Array; // 3 per triangle
}

export interface PixelPicture {
  side: number; // square
  rgba: Uint8ClampedArray; // 4 bytes per texel
}

export interface IslandPiece {
  index: number; // island number, stable for one mesh
  turnRad: number; // R16: the turn that stands the island upright, clockwise positive with the picture's y axis down
  triangles: number;
  source: { minX: number; minY: number; width: number; height: number; centreX: number; centreY: number; mask: Uint8Array }; // grown by PIECE_PADDING_PX, in source-albedo texels
  sheet: { x: number; y: number; width: number; height: number; originX: number; originY: number }; // where the turned box sits on the sheet; the origin is the box's corner in the turned frame around the island's centre
}

export interface UprightSheet {
  picture: PixelPicture; // the sheet, black where no piece is
  pieces: readonly IslandPiece[];
  scale: number; // one factor for every piece, at most 1
  mask: Uint8Array; // 1 where a piece's texel was drawn
}

export const NORMAL_TARGET_TILT_DEG = 45; // R18: the 95th percentile slope tilts this much
export const SLOPE_FLOOR = 0.01; // R18: smallest p95 used
export const EMPTY_ISLAND_SHARE = 0.05; // R15
export const BLACK_SUM = 24; // R15: R+G+B at or under this is black
export const PIECE_PADDING_PX = 3; // R15, R17
export const PIECE_GAP_PX = 4; // R17
export const SMOOTHING_SIGMA_PER_SIDE = 1 / 1100; // R18
export const MIN_UP_PROJECTION = 0.3; // R16
export const SCALE_STEP = 0.02; // R17
export const MIN_SCALE = 0.3; // R17

export const NO_BAKED_AREA = 'The albedo has no baked area to read relief from.';
export const SHEET_TOO_SMALL = 'The islands do not fit one sheet.';
export const UV_OUTSIDE_PICTURE = 'The UV layout reaches outside the picture.';
export const UV_MARGIN = 0.01; // R15: how far outside 0..1 a UV may sit (a share of the picture) before the layout is refused

// The flat normal every texel outside an island takes (R18, R19).
export const FLAT_NORMAL_RGBA: readonly [number, number, number, number] = [128, 128, 255, 255];

export function fillFlatNormal(rgba: Uint8ClampedArray): void {
  for (let i = 0; i < rgba.length; i += 4) rgba.set(FLAT_NORMAL_RGBA, i);
}
