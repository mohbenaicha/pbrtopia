import type { PixelImage } from '@mat/workerapi';
import { MAX_FEATHER, blurWrapped } from './bakeMasks';

export interface CoverageInput {
  labels: PixelImage; // R8
  selected: readonly number[]; // the labels whose pixels are covered
  feather: number; // 0 to `maxFeather` pixels at the labels' size
  /** The most the blur radius may be: `MAX_FEATHER` (4) unless the caller needs a wider falloff (the emissive dialog's Softness, export R40). */
  maxFeather?: number;
  side: number; // the size of the plane to build: the labels' size, or a smaller one for a preview
}

/** The labels at their nearest pixels on a `side` x `side` grid (the same picture when `side` is the labels' size). Time O(side^2). */
export function sampleLabels(labels: PixelImage, side: number): PixelImage {
  if (side === labels.width && side === labels.height) return labels;
  const scale = labels.width / side;
  const data = new Uint8Array(side * side);
  for (let y = 0; y < side; y += 1) {
    const row = Math.min(labels.height - 1, Math.floor(y * scale)) * labels.width;
    for (let x = 0; x < side; x += 1) data[y * side + x] = labels.data[row + Math.min(labels.width - 1, Math.floor(x * scale))]!;
  }
  return { width: side, height: side, channels: 1, data };
}

/**
 * Imageops R79: the share (0..255) of each pixel that lies in the selected components: 255 on their pixels, then the same wrapped box blur as the bake
 * (masks R44) so the edge fades over the project's feather. At a `side` smaller than the labels, the labels are taken at their nearest pixels and the
 * feather is scaled to that side. Null when nothing is selected (the whole map is edited, no blend). Time O(side^2 x (2r + 1)), r <= maxFeather; space one plane.
 */
export function buildCoverage({ labels, selected, feather, maxFeather = MAX_FEATHER, side }: CoverageInput): PixelImage | null {
  if (selected.length === 0) return null;
  const chosen = new Uint8Array(256);
  for (const label of selected) chosen[label & 255] = 255;
  const plane = sampleLabels(labels, side).data.map((label) => chosen[label]!);
  const radius = Math.min(Math.max(Math.round((feather * side) / labels.width), 0), maxFeather);
  return { width: side, height: side, channels: 1, data: radius === 0 ? plane : blurWrapped(plane, side, side, radius) };
}
