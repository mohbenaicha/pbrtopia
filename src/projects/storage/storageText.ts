import type { StorageEstimate } from './storageHealth';

const KIB = 1024;
const UNITS = ['KB', 'MB', 'GB', 'TB'];

/** Bytes in the units the storage texts use: "120 MB", "1.5 GB". */
export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes) / KIB;
  let unit = 0;
  while (value >= KIB && unit < UNITS.length - 1) {
    value /= KIB;
    unit += 1;
  }
  const text = Number.isInteger(Math.round(value * 10) / 10) ? String(Math.round(value)) : value.toFixed(1);
  return `${text} ${UNITS[unit]}`;
}

/** The sentence for low or full browser storage (projects R2). */
export function describeStorageShortage(estimate: StorageEstimate | null, full: boolean): string {
  if (full || estimate === null) return 'Browser storage is full, so changes cannot be saved.';
  return `Browser storage is almost full: ${formatBytes(estimate.quotaBytes - estimate.usedBytes)} free of ${formatBytes(estimate.quotaBytes)}.`;
}
