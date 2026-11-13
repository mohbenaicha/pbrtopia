import type { PixelImage } from '../gpu/pixelFormats';
import { detectEdges } from './detectEdges';

// Imageops R65, R66: the depth of the Blend edges zone, fixed or ending at the first edge. All depths are fractions of the picture's side.

/** R66: the edges are looked for on the map reduced to this many texels on its side. */
export const SEAM_PROFILE_MAX_SIDE = 512;
const NO_EDGE_DEPTH = 0.05;
const SMOOTHING_SHARE = 0.02;

/** R65: the fixed depth of both axes for a fade start in per cent: (100 - F) / 200 of the side. */
export const seamDepthOf = (fadeStartPercent: number): number => (100 - fadeStartPercent) / 200;

/** R66: where the first edge lies on each row (from the left) and each column (from the top), as a fraction of the side, or -1 when the first half has none. */
export interface EdgeDistances {
  size: number; // texels per line of the reduced map
  rows: Float32Array;
  columns: Float32Array;
}

/** The map as a grey picture of at most SEAM_PROFILE_MAX_SIDE texels on its side, each texel the mean luma of the box of source texels it covers. */
function reduceToLuma(image: PixelImage): PixelImage {
  const { width, height, channels, data } = image;
  const side = Math.min(SEAM_PROFILE_MAX_SIDE, width, height);
  const out = new Uint8Array(side * side);
  for (let ty = 0; ty < side; ty += 1) {
    const y0 = Math.floor((ty * height) / side);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / side));
    for (let tx = 0; tx < side; tx += 1) {
      const x0 = Math.floor((tx * width) / side);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / side));
      let sum = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const at = (y * width + x) * channels;
          sum += channels === 1 ? data[at]! : 0.299 * data[at]! + 0.587 * data[at + 1]! + 0.114 * data[at + 2]!;
        }
      }
      out[ty * side + tx] = Math.round(sum / ((x1 - x0) * (y1 - y0)));
    }
  }
  return { width: side, height: side, channels: 1, data: out };
}

/** R66: the one detection of a session: reduce the map, run the Canny pass, and note where the first edge is on every line. */
export function measureEdgeDistances(image: PixelImage): EdgeDistances {
  const reduced = reduceToLuma(image);
  const size = reduced.width;
  const edges = detectEdges(reduced);
  const half = Math.floor(size / 2);
  const rows = new Float32Array(size).fill(-1);
  const columns = new Float32Array(size).fill(-1);
  for (let line = 0; line < size; line += 1) {
    for (let position = 0; position < half; position += 1) {
      if (rows[line]! < 0 && edges[line * size + position] === 1) rows[line] = position / size;
      if (columns[line]! < 0 && edges[position * size + line] === 1) columns[line] = position / size;
    }
  }
  return { size, rows, columns };
}

/** The depth of every line: the first edge (5 % when none, at least a texel), never more than the fixed depth, then averaged over 2 % of the lines each side. */
function shapeLines(found: Float32Array, size: number, fixedDepth: number): Float32Array {
  const raw = Float32Array.from(found, (distance) => Math.min(fixedDepth, Math.max(1 / size, distance >= 0 ? distance : NO_EDGE_DEPTH)));
  const prefix = new Float64Array(size + 1);
  for (let line = 0; line < size; line += 1) prefix[line + 1] = prefix[line]! + raw[line]!;
  const radius = Math.max(1, Math.round(size * SMOOTHING_SHARE));
  return Float32Array.from(raw, (_, line) => {
    const from = Math.max(0, line - radius);
    const to = Math.min(size - 1, line + radius);
    return (prefix[to + 1]! - prefix[from]!) / (to - from + 1);
  });
}

/**
 * R66, R67: the profile the shaders read: `size` texels of rows then `size` of columns, each the depth as a fraction of the side. Cheap enough to redo on every
 * slider move (O(size)); it never touches the map.
 */
export function shapeSeamProfile(distances: EdgeDistances, fixedDepth: number): Float32Array {
  const { size } = distances;
  const profile = new Float32Array(size * 2);
  profile.set(shapeLines(distances.rows, size, fixedDepth), 0);
  profile.set(shapeLines(distances.columns, size, fixedDepth), size);
  return profile;
}

/** The depth (fraction of the side) a profile holds for one row or column. */
export function decodeSeamDepth(profile: Float32Array, lines: 'rows' | 'columns', index: number): number {
  return profile[(lines === 'rows' ? 0 : profile.length / 2) + index]!;
}
