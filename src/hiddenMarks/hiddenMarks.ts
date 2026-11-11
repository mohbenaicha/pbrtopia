// R12: which triangles are hidden, kept in the model file as glTF scene extras so the file and the marks cannot disagree.
export const MESH_EDIT_KEY = 'meshEdit';

type TriangleRange = [first: number, count: number];
export type HiddenRanges = Map<number, TriangleRange[]>;

interface HiddenFlagsOfMesh {
  meshOrdinal: number;
  hidden: Uint8Array; // 1 per hidden triangle
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function mergeRanges(ranges: TriangleRange[]): TriangleRange[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: TriangleRange[] = [];
  for (const [first, count] of sorted) {
    const last = merged[merged.length - 1];
    if (last && first <= last[0] + last[1]) last[1] = Math.max(last[1], first + count - last[0]);
    else merged.push([first, count]);
  }
  return merged;
}

/** The ranges stored in a loaded scene's `userData`; anything unreadable or of another version reads as nothing hidden. */
export function readHiddenMarks(sceneUserData: unknown): HiddenRanges {
  const result: HiddenRanges = new Map();
  if (typeof sceneUserData !== 'object' || sceneUserData === null) return result;
  const marks = (sceneUserData as Record<string, unknown>)[MESH_EDIT_KEY];
  if (typeof marks !== 'object' || marks === null) return result;
  const { v, hidden } = marks as { v?: unknown; hidden?: unknown };
  if (v !== 1 || typeof hidden !== 'object' || hidden === null || Array.isArray(hidden)) return result;
  for (const [key, value] of Object.entries(hidden)) {
    const ordinal = Number(key);
    if (!isCount(ordinal) || !Array.isArray(value)) continue;
    const ranges: TriangleRange[] = [];
    for (const entry of value as unknown[]) {
      if (Array.isArray(entry) && isCount(entry[0]) && isCount(entry[1]) && entry[1] > 0) ranges.push([entry[0], entry[1]]);
    }
    if (ranges.length > 0) result.set(ordinal, mergeRanges(ranges));
  }
  return result;
}

/** The value for `scene.userData.meshEdit`, or undefined when no triangle of any mesh is hidden. */
export function writeHiddenMarks(meshes: readonly HiddenFlagsOfMesh[]): { v: 1; hidden: Record<string, TriangleRange[]> } | undefined {
  const hidden: Record<string, TriangleRange[]> = {};
  for (const { meshOrdinal, hidden: flags } of meshes) {
    const ranges: TriangleRange[] = [];
    for (let t = 0; t < flags.length; t += 1) {
      if (!flags[t]) continue;
      const last = ranges[ranges.length - 1];
      if (last && last[0] + last[1] === t) last[1] += 1;
      else ranges.push([t, 1]);
    }
    if (ranges.length > 0) hidden[String(meshOrdinal)] = ranges;
  }
  return Object.keys(hidden).length > 0 ? { v: 1, hidden } : undefined;
}

/** Per-triangle flags from stored ranges; a range reaching past the last triangle is cut off. */
export function flagsFromRanges(ranges: readonly TriangleRange[] | undefined, triangleCount: number): Uint8Array {
  const flags = new Uint8Array(triangleCount);
  for (const [first, count] of ranges ?? []) flags.fill(1, Math.min(first, triangleCount), Math.min(first + count, triangleCount));
  return flags;
}
