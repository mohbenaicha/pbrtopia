// normal-height-edit R4: the minimum or maximum of a square window, separably (a monotonic queue per line, O(cells) whatever the radius). Edges repeat their edge cell;
// a cell that must not count holds +Infinity (for a minimum) or -Infinity (for a maximum).

/** The min (isMax false) or max of the window of half-width `radius` around every cell of a `width` x `height` grid. */
export function squareExtreme(source: Float32Array, width: number, height: number, radius: number, isMax: boolean): Float32Array {
  const alongRows = slidingExtreme(source, width, height, radius, isMax, true);
  return slidingExtreme(alongRows, width, height, radius, isMax, false);
}

function slidingExtreme(source: Float32Array, width: number, height: number, radius: number, isMax: boolean, alongX: boolean): Float32Array {
  const out = new Float32Array(width * height);
  const lines = alongX ? height : width;
  const length = alongX ? width : height;
  const line = new Float32Array(length);
  const queue = new Int32Array(length + 2 * radius + 2);
  const read = (index: number): number => line[index < 0 ? 0 : index >= length ? length - 1 : index]!;
  for (let a = 0; a < lines; a += 1) {
    for (let b = 0; b < length; b += 1) line[b] = alongX ? source[a * width + b]! : source[b * width + a]!;
    let head = 0;
    let tail = 0;
    const push = (index: number): void => {
      const value = read(index);
      while (tail > head && (isMax ? read(queue[tail - 1]!) <= value : read(queue[tail - 1]!) >= value)) tail -= 1;
      queue[tail++] = index;
    };
    for (let index = -radius; index < radius; index += 1) push(index);
    for (let x = 0; x < length; x += 1) {
      push(x + radius);
      while (queue[head]! < x - radius) head += 1;
      const best = read(queue[head]!);
      if (alongX) out[a * width + x] = best;
      else out[x * width + a] = best;
    }
  }
  return out;
}

/** The min or max of each `block` x `block` block (the last blocks may be smaller), as a coarse grid of ceil(width / block) x ceil(height / block). */
export function poolExtreme(source: Float32Array, width: number, height: number, block: number, isMax: boolean): { cells: Float32Array; width: number; height: number } {
  const coarseWidth = Math.ceil(width / block);
  const coarseHeight = Math.ceil(height / block);
  const cells = new Float32Array(coarseWidth * coarseHeight).fill(isMax ? -Infinity : Infinity);
  for (let y = 0; y < height; y += 1) {
    const row = Math.floor(y / block) * coarseWidth;
    for (let x = 0; x < width; x += 1) {
      const at = row + Math.floor(x / block);
      const value = source[y * width + x]!;
      if (isMax ? value > cells[at]! : value < cells[at]!) cells[at] = value;
    }
  }
  return { cells, width: coarseWidth, height: coarseHeight };
}

/** A coarse grid read at a full-resolution texel by bilinear interpolation (cell i is centred at (i + 0.5) * block - 0.5 texels). */
export function readCoarse(cells: Float32Array, coarseWidth: number, coarseHeight: number, block: number, x: number, y: number): number {
  if (block === 1) return cells[y * coarseWidth + x]!;
  const fx = (x + 0.5) / block - 0.5;
  const fy = (y + 0.5) / block - 0.5;
  const x0 = Math.max(0, Math.min(coarseWidth - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(coarseHeight - 1, Math.floor(fy)));
  const x1 = Math.min(coarseWidth - 1, x0 + 1);
  const y1 = Math.min(coarseHeight - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));
  const top = cells[y0 * coarseWidth + x0]! * (1 - tx) + cells[y0 * coarseWidth + x1]! * tx;
  const bottom = cells[y1 * coarseWidth + x0]! * (1 - tx) + cells[y1 * coarseWidth + x1]! * tx;
  return top * (1 - ty) + bottom * ty;
}
