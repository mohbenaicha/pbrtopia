import { NONE_LABEL } from '../quantise/classifyPixelsToPalette';

/**
 * Mask-bake-session R7: what a per-texel region bake needs of one session, built once from the labels and the gutter table (nearest island texel of each gutter texel, or null with no
 * coverage): the row runs of each label (so a label's texels are visited without scanning the picture), for each island texel the gutter texels that copy it (the inverse of the table, R9),
 * and, per feather radius, which masked texels have their whole window inside their own label (the blur of such a texel is exactly its table value). Pure: no DOM.
 */
export class TexelRegion {
  readonly labelRunStart = new Uint32Array(257); // runs of label L are runStart[labelRunStart[L] .. labelRunStart[L + 1])
  readonly runStart: Uint32Array; // index of a run's first texel; a run is on one row and holds one label
  readonly runLength: Uint16Array;
  readonly targetStart: Uint32Array | null; // gutter texels copying island texel i are targets[targetStart[i] .. targetStart[i + 1])
  readonly targets: Uint32Array | null;
  readonly seen: Uint8Array; // per texel: the mark of the edit that last recomputed it
  private mark = 0;
  private inner: { radius: number; flags: Uint8Array } | null = null;

  constructor(readonly labels: Uint8Array, readonly side: number, readonly table: Int32Array | null) {
    this.seen = new Uint8Array(labels.length);
    const counts = new Uint32Array(257);
    this.forEachRun((label) => {
      counts[label + 1] = counts[label + 1]! + 1;
    });
    for (let label = 0; label < 256; label += 1) counts[label + 1] = counts[label + 1]! + counts[label]!;
    this.labelRunStart.set(counts);
    this.runStart = new Uint32Array(counts[256]!);
    this.runLength = new Uint16Array(counts[256]!);
    const next = counts.slice(0, 256);
    this.forEachRun((label, start, length) => {
      this.runStart[next[label]!] = start;
      this.runLength[next[label]!] = length;
      next[label] = next[label]! + 1;
    });
    if (table === null) {
      this.targetStart = null;
      this.targets = null;
      return;
    }
    const start = new Uint32Array(labels.length + 1);
    for (let index = 0; index < table.length; index += 1) if (table[index]! >= 0) start[table[index]! + 1] = start[table[index]! + 1]! + 1;
    for (let index = 0; index < labels.length; index += 1) start[index + 1] = start[index + 1]! + start[index]!;
    const targets = new Uint32Array(start[labels.length]!);
    const fill = start.slice(0, labels.length);
    for (let index = 0; index < table.length; index += 1) {
      const source = table[index]!;
      if (source < 0) continue;
      targets[fill[source]!] = index;
      fill[source] = fill[source]! + 1;
    }
    this.targetStart = start;
    this.targets = targets;
  }

  private forEachRun(visit: (label: number, start: number, length: number) => void): void {
    const { labels, side } = this;
    for (let row = 0; row < side; row += 1) {
      let start = row * side;
      for (let index = start + 1; index <= (row + 1) * side; index += 1) {
        if (index < (row + 1) * side && labels[index] === labels[start]) continue;
        visit(labels[start]!, start, index - start);
        start = index;
      }
    }
  }

  /** A fresh mark for one edit (1 to 255); `seen` is cleared when the marks run out. */
  nextMark(): number {
    this.mark += 1;
    if (this.mark > 255) {
      this.seen.fill(0);
      this.mark = 1;
    }
    return this.mark;
  }

  /** 1 for a masked texel whose whole (2r+1)^2 window, clamp edges included, holds its own label. Kept for the last radius asked: the next feather change builds it anew. */
  innerOf(radius: number): Uint8Array {
    if (this.inner?.radius === radius) return this.inner.flags;
    const { side, labels } = this;
    const last = side - 1;
    const span = 2 * radius + 1;
    const run = new Uint8Array(labels.length); // length of the run of one label that ends at the texel, capped
    for (let y = 0; y < side; y += 1) {
      for (let x = 0; x < side; x += 1) {
        const index = y * side + x;
        run[index] = x > 0 && labels[index] === labels[index - 1] ? Math.min(run[index - 1]! + 1, 255) : 1;
      }
    }
    const across = new Uint8Array(labels.length); // 1 when the row window x-r..x+r is one label (columns that have a whole window only)
    for (let y = 0; y < side; y += 1) for (let x = radius; x <= last - radius; x += 1) across[y * side + x] = run[y * side + x + radius]! >= span ? 1 : 0;
    const flags = new Uint8Array(labels.length);
    for (let y = radius; y <= last - radius; y += 1) {
      for (let x = radius; x <= last - radius; x += 1) {
        const index = y * side + x;
        const label = labels[index]!;
        if (label === NONE_LABEL) continue;
        let all = 1;
        for (let dy = -radius; dy <= radius && all === 1; dy += 1) if (across[index + dy * side] !== 1 || labels[index + dy * side] !== label) all = 0;
        flags[index] = all;
      }
    }
    this.inner = { radius, flags };
    return flags;
  }
}
