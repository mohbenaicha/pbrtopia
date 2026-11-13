import { describe, expect, it } from 'vitest';
import { detectEdges } from '@mat/imageops/geometry/detectEdges';
import type { PixelImage } from '@mat/imageops';

const gray = (width: number, height: number, valueAt: (x: number, y: number) => number): PixelImage => {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data[y * width + x] = valueAt(x, y);
  return { width, height, channels: 1, data };
};

describe('seams detectEdges', () => {
  it('marks a vertical step edge and nothing far from it', () => {
    const edges = detectEdges(gray(64, 64, (x) => (x < 32 ? 40 : 200)));
    const columnsWithEdge = new Set<number>();
    for (let y = 8; y < 56; y += 1) for (let x = 0; x < 64; x += 1) if (edges[y * 64 + x] === 1) columnsWithEdge.add(x);
    expect(columnsWithEdge.size).toBeGreaterThan(0);
    for (const x of columnsWithEdge) expect(Math.abs(x - 31.5)).toBeLessThanOrEqual(3);
  });

  it('finds no edge in a flat image', () => {
    const edges = detectEdges(gray(32, 32, () => 120));
    expect(edges.every((value) => value === 0)).toBe(true);
  });

  it('returns one flag per pixel for a colour image', () => {
    const data = new Uint8Array(16 * 16 * 3).fill(90);
    expect(detectEdges({ width: 16, height: 16, channels: 3, data })).toHaveLength(256);
  });
});
