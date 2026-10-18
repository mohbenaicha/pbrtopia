import { isSafeBlobKey } from './projectRecords';

// Thrown by the readers below; `readProjectRecord` callers turn it into a `corrupt` store error.
export class FieldProblem extends Error {
  constructor(readonly fieldPath: string) {
    super(`The saved project has a missing or wrong value at "${fieldPath}".`);
  }
}

export type RawRecord = Record<string, unknown>;

export const isRawRecord = (value: unknown): value is RawRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

export function readObject(value: unknown, path: string): RawRecord {
  if (!isRawRecord(value)) throw new FieldProblem(path);
  return value;
}

export function readText(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new FieldProblem(path);
  return value;
}

export function readNonEmptyText(value: unknown, path: string): string {
  if (typeof value !== 'string' || value === '') throw new FieldProblem(path);
  return value;
}

export function readTimestamp(value: unknown, path: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new FieldProblem(path);
  return value;
}

export function readCount(value: unknown, path: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) throw new FieldProblem(path);
  return value;
}

export function readDuration(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new FieldProblem(path);
  return value;
}

export function readChoice<T extends string | number>(value: unknown, path: string, allowed: readonly T[]): T {
  const found = allowed.find((option) => option === value);
  if (found === undefined) throw new FieldProblem(path);
  return found;
}

export function readBlobKey(value: unknown, path: string): string {
  if (typeof value !== 'string' || !isSafeBlobKey(value)) throw new FieldProblem(path);
  return value;
}

export function readList<T>(value: unknown, path: string, readItem: (item: unknown, itemPath: string) => T): T[] {
  if (!Array.isArray(value)) throw new FieldProblem(path);
  return value.map((item, index) => readItem(item, `${path}[${index}]`));
}

// An optional field is absent or undefined; null is not accepted (records are written without it).
export function readOptional<T>(value: unknown, read: (present: unknown) => T): T | undefined {
  return value === undefined ? undefined : read(value);
}
