// The five PNG row filters (maps R58). `bpp` is bytes per pixel, at least one.

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function predictor(type: number, row: Uint8Array, previous: Uint8Array | null, index: number, bpp: number): number {
  const left = index >= bpp ? row[index - bpp]! : 0;
  const up = previous ? previous[index]! : 0;
  const upLeft = previous && index >= bpp ? previous[index - bpp]! : 0;
  switch (type) {
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return (left + up) >> 1;
    case 4:
      return paeth(left, up, upLeft);
    default:
      return 0;
  }
}

/** Reverses the filters: `filtered` holds a type byte then `rowBytes` bytes for each of `height` rows. */
export function removeFilters(filtered: Uint8Array, rowBytes: number, height: number, bpp: number): Uint8Array {
  const out = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    const type = filtered[y * (rowBytes + 1)]!;
    if (type > 4) throw new Error(`Unknown PNG filter ${type}`);
    const source = filtered.subarray(y * (rowBytes + 1) + 1, (y + 1) * (rowBytes + 1));
    const row = out.subarray(y * rowBytes, (y + 1) * rowBytes);
    const previous = y > 0 ? out.subarray((y - 1) * rowBytes, y * rowBytes) : null;
    for (let x = 0; x < rowBytes; x += 1) row[x] = (source[x]! + predictor(type, row, previous, x, bpp)) & 255;
  }
  return out;
}

function rowCost(row: Uint8Array, previous: Uint8Array | null, type: number, bpp: number): number {
  let cost = 0;
  for (let x = 0; x < row.length; x += 1) {
    const residual = (row[x]! - predictor(type, row, previous, x, bpp)) & 255;
    cost += residual < 128 ? residual : 256 - residual;
  }
  return cost;
}

/** Filters every row, choosing per row the filter with the smallest sum of absolute residuals. */
export function applyFilters(raw: Uint8Array, rowBytes: number, height: number, bpp: number): Uint8Array {
  const out = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = raw.subarray(y * rowBytes, (y + 1) * rowBytes);
    const previous = y > 0 ? raw.subarray((y - 1) * rowBytes, y * rowBytes) : null;
    let bestType = 0;
    let bestCost = Infinity;
    for (let type = 0; type <= 4; type += 1) {
      const cost = rowCost(row, previous, type, bpp);
      if (cost < bestCost) {
        bestCost = cost;
        bestType = type;
      }
    }
    out[y * (rowBytes + 1)] = bestType;
    for (let x = 0; x < rowBytes; x += 1) out[y * (rowBytes + 1) + 1 + x] = (row[x]! - predictor(bestType, row, previous, x, bpp)) & 255;
  }
  return out;
}
