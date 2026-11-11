import { vi } from 'vitest';
import { storeFailure, type StoreResult } from '@shared/projects';
import { commitMapOperation, type MapCommitPorts } from '@mat/maps/commitMapOperation';
import { planApplyEdits, planChangeSize, planRestoreOriginal, type ImageEdit, type MapPlan, type PlanIo } from '@mat/maps/mapActions';
import { checkMapsInvariants, clearMap, referencedMapKeys, undoMaps } from '@mat/maps/mapOperations';
import type { MapKind } from '@mat/maps/mapKinds';
import type { MapsState, MaterialSize } from '@mat/maps/mapRecord';
import { planDrop } from '@mat/maps/drop/planDrop';
import { planCommitMasks, type MasksCommit } from '@mat/maps/planCommitMasks';
import { planPlaceGenerated, type GeneratedMap } from '@mat/maps/planPlaceGenerated';
import { reportMissingFiles } from '@mat/maps/missingFiles';
import type { PixelImage } from '@mat/maps/png/pngCodec';
import { decodePngOffThread, encodePngBlob, encodeResizedPngBlob } from '@mat/maps/png/pngOffThread';

// The footprint rig: the real planners and the real commit order (maps R29) over an in-memory file store, with the picture work counted.
// Generation is mocked: tiles are plain pixel images handed to planPlaceGenerated, as the run would after cutting its returned picture.

export const solid = (side: number, channels: 1 | 3, value = 100): PixelImage => ({ width: side, height: side, channels, data: new Uint8Array(side * side * channels).fill(value) });

/** What one operation cost: files that appeared, files that went, PNG encodes, stored-file decodes, record commits. */
export interface Cost {
  written: number;
  deleted: number;
  encodes: number;
  decodes: number;
  commits: number;
}

const succeeded: StoreResult<void> = { ok: true, value: undefined };

export interface Rig {
  files: Map<string, Blob>;
  state(): MapsState;
  /** Fails the next record commit once. */
  failNextCommit(): void;
  /** Makes every file delete fail (maps R31: left for the next sweep). */
  failDeletes(): void;
  place(generated: readonly GeneratedMap[]): Promise<Cost>;
  drop(kind: MapKind, image: PixelImage): Promise<Cost>;
  edit(edits: readonly ImageEdit[], label?: string, grouped?: boolean): Promise<Cost>;
  restore(kind: MapKind): Promise<Cost>;
  changeSize(size: MaterialSize): Promise<Cost>;
  undo(kinds: readonly MapKind[]): Promise<Cost>;
  clear(kind: MapKind): Promise<Cost>;
  masks(commit: MasksCommit): Promise<Cost>;
  /** The opening sweep reports these keys as missing: their files go, the report drops the undo entries and the released files are deleted (maps R30). */
  missing(keys: readonly string[]): Promise<Cost>;
  /** Maps R73: the stored files are exactly the referenced ones, no map names more than three files, the invariants hold. */
  problems(): string[];
}

const encodeCalls = (): number => vi.mocked(encodePngBlob).mock.calls.length + vi.mocked(encodeResizedPngBlob).mock.calls.length;
const decodeCalls = (): number => vi.mocked(decodePngOffThread).mock.calls.length;

export function createRig(): Rig {
  const files = new Map<string, Blob>();
  let state: MapsState = { size: null, maps: {} };
  let counter = 0;
  let commits = 0;
  let commitFails = false;
  let deletesFail = false;
  const newKey = (): string => `k${(counter += 1)}`;
  const ports: MapCommitPorts = {
    writeBlob: async (key, blob) => (files.set(key, blob), succeeded),
    deleteBlob: async (key) => {
      if (deletesFail) return storeFailure('storage-unavailable', 'delete failed');
      files.delete(key);
      return succeeded;
    },
    commit: async (next) => {
      if (commitFails) {
        commitFails = false;
        return storeFailure('storage-unavailable', 'save failed');
      }
      state = next;
      commits += 1;
      return succeeded;
    },
    estimateFreeBytes: async () => null,
  };
  const io: PlanIo = { readBlob: async (key) => files.get(key) ?? null, newKey, label: (kind) => kind };

  async function measure(work: () => Promise<void>): Promise<Cost> {
    const before = new Set(files.keys());
    const encodesBefore = encodeCalls();
    const decodesBefore = decodeCalls();
    const commitsBefore = commits;
    await work();
    const after = new Set(files.keys());
    return {
      written: [...after].filter((key) => !before.has(key)).length,
      deleted: [...before].filter((key) => !after.has(key)).length,
      encodes: encodeCalls() - encodesBefore,
      decodes: decodeCalls() - decodesBefore,
      commits: commits - commitsBefore,
    };
  }
  const commitPlan = (plan: MapPlan): Promise<Cost> => planned(async () => plan);
  // the plan is built inside the measured span, so its encodes and decodes count
  const planned = (build: () => Promise<MapPlan>): Promise<Cost> =>
    measure(async () => {
      const plan = await build();
      await commitMapOperation({ before: state, next: plan.next, newBlobs: plan.newBlobs, otherReferencedKeys: new Set(), ports });
    });

  return {
    files,
    state: () => state,
    failNextCommit: () => void (commitFails = true),
    failDeletes: () => void (deletesFail = true),
    place: (generated) => planned(() => planPlaceGenerated(state, generated, newKey)),
    drop: (kind, image) =>
      planned(async () => {
        const outcome = await planDrop({ state, kind, image, fileName: 'dropped.png', newKey });
        if (!outcome.ok) throw new Error(outcome.message);
        return outcome.plan;
      }),
    edit: (edits, label = 'Filter', grouped = false) => planned(async () => {
      const outcome = await planApplyEdits(state, edits, label, grouped, io);
      if (!outcome.ok) throw new Error('edit refused');
      return outcome.plan;
    }),
    restore: (kind) => planned(async () => {
      const outcome = await planRestoreOriginal(state, kind, io);
      if (!outcome.ok) throw new Error(outcome.message);
      return outcome.plan;
    }),
    changeSize: (size) => planned(async () => {
      const outcome = await planChangeSize(state, size, io);
      if (!outcome.ok) throw new Error(outcome.message);
      return outcome.plan;
    }),
    undo: (kinds) => commitPlan({ next: undoMaps(state, kinds), newBlobs: new Map() }),
    clear: (kind) => commitPlan({ next: clearMap(state, kind), newBlobs: new Map() }),
    masks: (commit) => planned(() => planCommitMasks(state, commit, { newKey })),
    missing: (keys) =>
      measure(async () => {
        for (const key of keys) files.delete(key);
        const report = reportMissingFiles(state, keys, 'albedo');
        await ports.commit(report.state);
        for (const key of report.released) await ports.deleteBlob(key);
      }),
    problems: () => {
      const found = checkMapsInvariants(state);
      const referenced = referencedMapKeys(state);
      for (const key of files.keys()) if (!referenced.has(key)) found.push(`orphan file ${key}`);
      for (const key of referenced) if (!files.has(key)) found.push(`dangling key ${key}`);
      for (const [kind, map] of Object.entries(state.maps)) {
        const distinct = new Set([map!.originalKey, map!.workingKey, map!.undoKey].filter((key) => key !== null)).size;
        if (distinct > (kind === 'labels' ? 2 : 3)) found.push(`${kind}: ${distinct} distinct files`);
      }
      return found;
    },
  };
}
