import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RawRecord, StoreResult } from '@shared/projects';
import { saveBlobAsFile } from '@shared/ui-kit';
import { commitMapOperation } from './commitMapOperation';
import { decodeImageFile, type DecodeOutcome } from './drop/decodeImageFile';
import { planDrop } from './drop/planDrop';
import { pickDroppedImage } from './drop/pickDroppedImage';
import { planApplyEdits, planChangeSize, planRestoreOriginal, type ImageEdit, type MapPlan } from './mapActions';
import { mapDownloadName } from './mapDownloadName';
import { clearMap, undoMaps, undoTargets } from './mapOperations';
import type { MapKind } from './mapKinds';
import type { MapsState, MaterialSize } from './mapRecord';
import type { PendingMaps } from './pendingMaps';
import { planCommitMasks, type MasksCommit } from './planCommitMasks';
import type { GpuResizer } from './resizeToSquareBlob';
import { planPlaceGenerated, type GeneratedMap } from './planPlaceGenerated';
import { kindLabel } from './ui/buildCardModel';

/** What the controller needs from the open project. The app binds it to the store and the record. */
export interface MapsHost {
  state: MapsState;
  canWrite: boolean;
  projectName: string;
  colorMode: 'albedo' | 'diffuse';
  readBlob(key: string): Promise<Blob | null>;
  writeBlob(key: string, blob: Blob): Promise<StoreResult<void>>;
  deleteBlob(key: string): Promise<StoreResult<void>>;
  /** Stores the record with the next maps at once and reports whether it was stored (maps R29, R65). */
  commit(next: MapsState, masks?: RawRecord): Promise<StoreResult<void>>;
  /** Keys that fields outside the maps still use (reference images): never deleted. */
  otherReferencedKeys(): ReadonlySet<string>;
  estimateFreeBytes(): Promise<number | null>;
  newKey(): string;
  /** Resamples a whole picture to S x S on the graphics card (maps R27); when absent or failing, the page-side rule does it. */
  resize?: GpuResizer;
  decodeFile?: (file: File) => Promise<DecodeOutcome>;
  saveBlob?: (blob: Blob, fileName: string) => void;
}

export interface MapsMessage {
  tone: 'error' | 'notice';
  text: string;
}

/** A map name, or `size` while S is being changed. */
export type BusyTarget = MapKind | 'size';

export interface MapsController {
  busy: ReadonlySet<BusyTarget>;
  /** Maps R71: pictures that the preview may show while they are being saved; each leaves when the record carries its key or the save fails. */
  pending: PendingMaps;
  message: MapsMessage | null;
  dismissMessage(): void;
  /** Shows why something the person did was not taken (maps R42). */
  refuse(text: string): void;
  dropFiles(kind: MapKind, files: readonly File[]): Promise<void>;
  undo(kinds: readonly MapKind[]): Promise<void>;
  /** Imageops results become the maps' new working files, each with its own undo entry (grouped for a geometry op). True when committed. */
  applyEdits(edits: readonly ImageEdit[], label: string, grouped: boolean): Promise<boolean>;
  /** Masks R47: new labels and/or a new bake of rough and metal, stored in one commit with the masks record. True when committed. */
  commitMasks(commit: MasksCommit, masks: RawRecord): Promise<boolean>;
  /** Compositing R22: one commit of a plan the caller builds from the maps as they are when it runs (a painting session's result); `targets` are the maps it writes. True when committed. */
  commitPlanned(targets: readonly MapKind[], plan: (state: MapsState, io: { newKey(): string }) => Promise<MapPlan>): Promise<boolean>;
  /** Generation R42: cut tiles become the originals of their maps in one commit (maps R12-R14). True when committed. */
  placeGenerated(generated: readonly GeneratedMap[]): Promise<boolean>;
  restoreOriginal(kind: MapKind): Promise<void>;
  clear(kind: MapKind): Promise<void>;
  changeSize(size: MaterialSize): Promise<void>;
  download(kind: MapKind): Promise<void>;
}

const READ_ONLY = 'This project is open in another tab, so it cannot be changed here.';

/**
 * Maps R17-R23, R29, R43, R48-R49: runs one map operation at a time, in the order received, through the write-commit-delete order.
 * A drop on a map that is being worked on is refused as "Busy"; a failure leaves the record as it was and becomes a message.
 */
export function useMapsController(host: MapsHost): MapsController {
  const hostRef = useRef(host);
  hostRef.current = host;
  const stateRef = useRef(host.state);
  const inFlight = useRef(0);
  if (inFlight.current === 0) stateRef.current = host.state; // while an operation runs, the state it is building wins
  const chain = useRef<Promise<void>>(Promise.resolve());
  const busyRef = useRef(new Set<BusyTarget>());
  const [busy, setBusy] = useState<ReadonlySet<BusyTarget>>(new Set());
  const [message, setMessage] = useState<MapsMessage | null>(null);
  const [pending, setPending] = useState<PendingMaps>({});
  const withdrawPending = useCallback((kind: MapKind) => setPending((current) => {
    if (current[kind] === undefined) return current;
    const rest = { ...current };
    delete rest[kind];
    return rest;
  }), []);
  // Maps R71: a pending picture leaves once the record carries its working key (the preview keeps the very same decoded picture).
  useEffect(() => {
    const done = (Object.keys(pending) as MapKind[]).filter((kind) => host.state.maps[kind]?.workingKey === pending[kind]!.workingKey);
    for (const kind of done) withdrawPending(kind);
  }, [pending, host.state, withdrawPending]);

  const enqueue = useCallback((targets: BusyTarget[], work: () => Promise<void>): Promise<void> => {
    for (const target of targets) busyRef.current.add(target);
    inFlight.current += 1;
    setBusy(new Set(busyRef.current));
    const done = chain.current.then(work).catch(() => setMessage({ tone: 'error', text: 'That could not be done.' }));
    chain.current = done.then(() => {
      inFlight.current -= 1;
      for (const target of targets) busyRef.current.delete(target);
      setBusy(new Set(busyRef.current));
    });
    return chain.current;
  }, []);

  const commitPlan = useCallback(async (plan: MapPlan, masks?: RawRecord): Promise<boolean> => {
    const current = hostRef.current;
    const result = await commitMapOperation({
      before: stateRef.current,
      next: plan.next,
      newBlobs: plan.newBlobs,
      otherReferencedKeys: current.otherReferencedKeys(),
      ...(masks === undefined ? {} : { masks }),
      ports: { writeBlob: current.writeBlob, deleteBlob: current.deleteBlob, commit: current.commit, estimateFreeBytes: current.estimateFreeBytes },
    });
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error.message });
      return false;
    }
    stateRef.current = plan.next;
    return true;
  }, []);

  const guarded = useCallback(
    (targets: BusyTarget[], work: () => Promise<void>): Promise<void> => {
      if (!hostRef.current.canWrite) {
        setMessage({ tone: 'error', text: READ_ONLY });
        return Promise.resolve();
      }
      setMessage(null);
      return enqueue(targets, work);
    },
    [enqueue],
  );

  const resizeOf = useCallback(() => (hostRef.current.resize === undefined ? {} : { resize: hostRef.current.resize }), []);
  const planIo = useCallback(() => ({ readBlob: (key: string) => hostRef.current.readBlob(key), newKey: () => hostRef.current.newKey(), label: (kind: MapKind) => kindLabel(kind, hostRef.current.colorMode), ...resizeOf() }), [resizeOf]);
  const commitOrMessage = useCallback(
    async (plan: Promise<{ ok: true; plan: MapPlan } | { ok: false; message: string }>): Promise<void> => {
      const outcome = await plan;
      if (!outcome.ok) setMessage({ tone: 'error', text: outcome.message });
      else await commitPlan(outcome.plan);
    },
    [commitPlan],
  );

  return useMemo<MapsController>(
    () => ({
      busy,
      pending,
      message,
      dismissMessage: () => setMessage(null),
      refuse: (text) => setMessage({ tone: 'error', text }),

      dropFiles: async (kind, files) => {
        if (busyRef.current.has(kind) || busyRef.current.has('size')) {
          setMessage({ tone: 'error', text: 'Busy' });
          return;
        }
        await guarded([kind], async () => {
          const picked = await pickDroppedImage(files, hostRef.current.decodeFile ?? decodeImageFile);
          if (!picked.ok) return setMessage({ tone: 'error', text: picked.message });
          let stored = false;
          try {
            const outcome = await planDrop({
              state: stateRef.current, kind, image: picked.image, fileName: picked.fileName, newKey: () => hostRef.current.newKey(), ...resizeOf(),
              onPending: (map) => setPending((current) => ({ ...current, [kind]: map })), // maps R71
            });
            if (!outcome.ok) return setMessage({ tone: 'error', text: outcome.message });
            stored = await commitPlan(outcome.plan);
            if (stored && picked.notice !== null) setMessage({ tone: 'notice', text: picked.notice });
          } finally {
            if (!stored) withdrawPending(kind); // the save did not happen: the preview goes back to the previous picture
          }
        });
      },

      undo: (kinds) => {
        const targets = undoTargets(stateRef.current, kinds);
        if (targets.length === 0) return Promise.resolve();
        return guarded(targets, async () => {
          for (const kind of targets) {
            const undoKey = stateRef.current.maps[kind]?.undoKey;
            const present = undoKey != null && (await hostRef.current.readBlob(undoKey).catch(() => null)) !== null;
            if (!present) return setMessage({ tone: 'error', text: `${kindLabel(kind, hostRef.current.colorMode)}: file missing` }); // keeps the working copy (maps R30)
          }
          await commitPlan({ next: undoMaps(stateRef.current, kinds), newBlobs: new Map() });
        });
      },

      applyEdits: async (edits, label, grouped) => {
        let applied = false;
        await guarded(edits.map((edit) => edit.kind), async () => {
          const outcome = await planApplyEdits(stateRef.current, edits, label, grouped, planIo());
          if (!outcome.ok) return setMessage({ tone: 'error', text: outcome.message });
          applied = await commitPlan(outcome.plan);
        });
        return applied;
      },

      commitMasks: async (commit, masks) => {
        let stored = false;
        const targets: MapKind[] = [...(commit.labels !== undefined ? ['labels' as const] : []), ...(commit.bake !== undefined ? ['rough' as const, 'metal' as const] : [])];
        await guarded(targets, async () => {
          stored = await commitPlan(await planCommitMasks(stateRef.current, commit, { newKey: () => hostRef.current.newKey() }), masks);
        });
        return stored;
      },

      commitPlanned: async (targets, plan) => {
        let stored = false;
        await guarded([...targets], async () => {
          stored = await commitPlan(await plan(stateRef.current, { newKey: () => hostRef.current.newKey() }));
        });
        return stored;
      },

      placeGenerated: async (generated) => {
        let stored = false;
        await guarded(generated.map((map) => map.kind), async () => {
          stored = await commitPlan(await planPlaceGenerated(stateRef.current, generated, () => hostRef.current.newKey(), hostRef.current.resize));
        });
        return stored;
      },

      restoreOriginal: (kind) => guarded([kind], () => commitOrMessage(planRestoreOriginal(stateRef.current, kind, planIo()))),

      clear: (kind) => guarded([kind], async () => void (await commitPlan({ next: clearMap(stateRef.current, kind), newBlobs: new Map() }))),

      changeSize: (size) =>
        guarded(['size', ...(Object.keys(stateRef.current.maps) as MapKind[])], () => commitOrMessage(planChangeSize(stateRef.current, size, planIo()))),

      download: async (kind) => {
        const map = stateRef.current.maps[kind];
        if (map === undefined) return;
        const blob = await hostRef.current.readBlob(map.workingKey);
        if (blob === null) return setMessage({ tone: 'error', text: `${kindLabel(kind, hostRef.current.colorMode)}: the file cannot be read.` });
        const { projectName, colorMode, saveBlob } = hostRef.current;
        (saveBlob ?? saveBlobAsFile)(blob, mapDownloadName(projectName, kind, colorMode));
      },
    }),
    [busy, pending, message, guarded, commitPlan, commitOrMessage, planIo, withdrawPending],
  );
}
