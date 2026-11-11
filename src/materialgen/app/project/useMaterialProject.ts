import { useCallback, useEffect, useRef, useState } from 'react';
import { createDebouncedSaver, flushOnTabHide, normalizeProjectName, storeFailure, type DebouncedSaver, type StoreResult } from '@shared/projects';
import type { MaterialProjectStore, MaterialRecord } from '@mat/storage';

export const AUTOSAVE_DELAY_MS = 400; // materialgen app R33
const SAVE_KEY = 'project';

export interface OpenMaterial {
  record: MaterialRecord | null; // null while it loads, or when it could not be opened
  loading: boolean;
  error: string | null; // why the project could not be opened
  whenSwept(): Promise<void>; // resolves when the opening sweep has finished; file writes wait for it (maps R30)
  missingFiles: string[]; // blob keys the record names that the store does not have, found by the sweep when the project opened (app R34)
  edit(change: (record: MaterialRecord) => MaterialRecord): void; // app R33: queues a save; does nothing in read-only mode
  /** Stores the changed record now and applies it on screen only when it was stored (maps R29, R65). */
  commit(change: (record: MaterialRecord) => MaterialRecord): Promise<StoreResult<void>>;
  rename(name: string): Promise<StoreResult<void>>;
  flush(): Promise<StoreResult<void>>; // writes what is waiting now (leaving, export)
}

interface Options {
  store: Pick<MaterialProjectStore, 'loadProject' | 'saveProject' | 'renameProject' | 'sweepOrphanBlobs'>;
  projectId: string;
  canWrite: boolean; // this tab holds the project's lock (app R32)
  onSaveFailure?: (code: string) => void; // app R33: the reason goes to the storage warning
}

/** Settles once the opening sweep has finished, so a file written before then cannot be swept as an orphan (maps R30). */
function newSweepGate(): { done: Promise<void>; open(): void } {
  let open: () => void = () => undefined;
  const done = new Promise<void>((resolve) => (open = resolve));
  return { done, open };
}

/** Materialgen app R12b, R33, R34: reads the record, saves its edits after a short quiet moment, flushes on tab hide and on close, and sweeps unreferenced files when opened writable. */
export function useMaterialProject({ store, projectId, canWrite, onSaveFailure }: Options): OpenMaterial {
  const [record, setRecord] = useState<MaterialRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const sweepGate = useRef(newSweepGate());
  const latest = useRef<MaterialRecord | null>(null);
  const saver = useRef<DebouncedSaver<MaterialRecord> | null>(null);
  const onFailure = useRef(onSaveFailure);
  onFailure.current = onSaveFailure;

  useEffect(() => {
    let current = true;
    latest.current = null;
    setRecord(null);
    setError(null);
    setMissingFiles([]);
    sweepGate.current = newSweepGate();
    const created = createDebouncedSaver<MaterialRecord>({
      delayMs: AUTOSAVE_DELAY_MS,
      write: async (entries) => {
        const last = entries[entries.length - 1];
        return last === undefined ? { ok: true, value: undefined } : store.saveProject(last.value);
      },
      onFailure: (failure) => onFailure.current?.(failure.code),
    });
    saver.current = created;
    const stopListening = flushOnTabHide(created);
    void store.loadProject(projectId).then((result) => {
      if (!current) return;
      if (!result.ok) return setError(result.error.message);
      latest.current = result.value;
      setRecord(result.value);
    });
    return () => {
      current = false;
      stopListening();
      void created.flush().finally(() => created.dispose()); // closing the project keeps what was waiting (app R12)
      saver.current = null;
    };
  }, [store, projectId]);

  const loaded = record !== null;
  useEffect(() => {
    if (!loaded || !canWrite) return;
    let current = true;
    const gate = sweepGate.current;
    void store
      .sweepOrphanBlobs(projectId)
      .then((swept) => {
        if (current && swept.ok) setMissingFiles(swept.value.missing); // app R34: the files the record names that are not there
      })
      .finally(gate.open);
    return () => {
      current = false;
    };
  }, [store, projectId, loaded, canWrite]);

  const edit = useCallback(
    (change: (record: MaterialRecord) => MaterialRecord): void => {
      if (!canWrite || latest.current === null || saver.current === null) return;
      const next = change(latest.current);
      latest.current = next;
      setRecord(next);
      saver.current.queue(SAVE_KEY, next);
    },
    [canWrite],
  );

  const whenSwept = useCallback((): Promise<void> => sweepGate.current.done, []);

  const flush = useCallback((): Promise<StoreResult<void>> => saver.current?.flush() ?? Promise.resolve({ ok: true, value: undefined }), []);

  const commit = useCallback(
    async (change: (record: MaterialRecord) => MaterialRecord): Promise<StoreResult<void>> => {
      if (!canWrite || latest.current === null || saver.current === null) return storeFailure('aborted', 'This project is open in another tab, so it cannot be changed here.');
      const flushed = await flush(); // what waits goes first, so the stored record never goes back
      if (!flushed.ok) return flushed;
      const base = latest.current;
      const next = change(base);
      const stored = await store.saveProject(next);
      if (!stored.ok) {
        onFailure.current?.(stored.error.code);
        return stored; // the screen and the waiting record stay as they were
      }
      const edited = latest.current !== base; // a field was edited while the record was being stored: keep it, on top of the stored change
      latest.current = edited ? change(latest.current ?? base) : next;
      setRecord(latest.current);
      if (edited) saver.current?.queue(SAVE_KEY, latest.current);
      return stored;
    },
    [canWrite, flush, store],
  );

  const rename = useCallback(
    async (typed: string): Promise<StoreResult<void>> => {
      if (!canWrite) return storeFailure('aborted', 'This project is open in another tab, so it cannot be renamed here.');
      const name = normalizeProjectName(typed);
      if (name === null) return storeFailure('aborted', 'Enter a name of 1 to 120 characters.');
      await flush(); // a waiting save carries the old name; it goes first
      const result = await store.renameProject(projectId, name);
      if (result.ok && latest.current !== null) {
        latest.current = { ...latest.current, name };
        setRecord(latest.current);
      }
      return result;
    },
    [canWrite, flush, store, projectId],
  );

  return { record, loading: record === null && error === null, error, missingFiles, whenSwept, edit, commit, rename, flush };
}
