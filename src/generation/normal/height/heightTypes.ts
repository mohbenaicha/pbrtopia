// normal-height-edit contracts: the plain shapes and constants of the height route. No DOM, no store.

/** The base height after the Gaussian (R3), with what is fixed by it: the owner map and the 95th percentile slope (R6). Texels of no island hold 0. */
export interface SmoothedHeight {
  smoothed: Float32Array; // side x side
  p95: number;
  owner: Uint16Array; // buildOwnerMap
  side: number;
}

/** R4's linear form: a pass is `h + p * D`, with D fixed by the pass's input alone. */
export interface SharpnessDeltas {
  d0: Float32Array; // from the smoothed height
  d1: Float32Array; // from smoothed + d0
}

export const RADII_AT_1024 = [8, 32, 128] as const; // R4: window half-widths in texels at a 1024 side
export const FADE_RANGE = 8 / 255; // R4: R0, a window whose whole rise is below this is quantisation, not a slope
export const POOL_CELLS_PER_RADIUS = 8; // R4: a radius above this many texels is windowed on blocks of `floor(radius / 8)` texels
export const MAX_SHARPNESS = 2; // R4, R9
