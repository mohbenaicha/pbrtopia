import type { Edges } from '../edges';

/**
 * Masks R20, material-masks-core R5: one pass of a 3 x 3 majority filter over the labels as they were. The window wraps at the edges by default; with
 * `edges: 'clamp'` a window that leaves the picture repeats the border cell instead. A pixel takes the most frequent label in its window; its own
 * label wins a tie, and a tie between other labels goes to the lowest.
 */
export function majorityFilter(labels: Uint8Array, size: number, count: number, edges: Edges = 'wrap'): Uint8Array {
  const result = new Uint8Array(labels.length);
  const tally = new Int32Array(count);
  const before = edges === 'wrap' ? size - 1 : 0;
  const after = edges === 'wrap' ? 0 : size - 1;
  const previous = (value: number): number => (value === 0 ? before : value - 1);
  const following = (value: number): number => (value === size - 1 ? after : value + 1);
  for (let y = 0; y < size; y += 1) {
    const rows = [previous(y) * size, y * size, following(y) * size];
    for (let x = 0; x < size; x += 1) {
      const columns = [previous(x), x, following(x)];
      tally.fill(0);
      for (const row of rows) {
        for (const column of columns) {
          const label = labels[row + column]!;
          tally[label] = tally[label]! + 1;
        }
      }
      const own = labels[y * size + x]!;
      let chosen = own;
      let best = tally[own]!;
      for (let label = 0; label < count; label += 1) {
        if (tally[label]! > best) {
          best = tally[label]!;
          chosen = label;
        }
      }
      result[y * size + x] = chosen;
    }
  }
  return result;
}
