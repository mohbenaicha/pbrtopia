import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectImportState, StoreResult } from '../projects';

/** Reads the zip and stores it as a new project; `onProgress(done, total)` counts entries. The app binds its own store and zip format. */
export type RunProjectImport<R extends { name: string }> = (zip: ReadableStream<Uint8Array>, onProgress: (done: number, total: number) => void) => Promise<StoreResult<R>>;

/** Projects R12: imports a project zip; one import at a time, a failure becomes a message. Held by `App`, so its state outlives the list and the settings views. */
export function useProjectZipImport<R extends { name: string }>(runImport: RunProjectImport<R>, onImported?: (project: R) => void): ProjectImportState {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const latestOnImported = useRef(onImported);
  latestOnImported.current = onImported;
  const latestRun = useRef(runImport); // a new function each render must not change `start`
  latestRun.current = runImport;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = useCallback(async (file: File): Promise<void> => {
    if (running.current) return;
    running.current = true;
    setImporting(true);
    setProgress(0);
    setMessage(null);
    setError(null);
    let doneMessage: string | null = null;
    let failure: string | null = null;
    try {
      const result = await latestRun.current(file.stream(), (done, total) => {
        if (mounted.current) setProgress(total > 0 ? Math.min(1, done / total) : 0);
      });
      if (result.ok) {
        doneMessage = `Imported ${result.value.name}.`;
        latestOnImported.current?.(result.value);
      } else failure = result.error.message;
    } catch {
      failure = 'The project could not be imported.';
    }
    running.current = false;
    if (!mounted.current) return;
    setImporting(false);
    setProgress(null);
    setMessage(doneMessage);
    setError(failure);
  }, []);

  return { importing, progress, message, error, start };
}
