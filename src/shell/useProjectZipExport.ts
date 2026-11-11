import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoreResult } from '../projects';

export interface ProjectZipExport {
  exporting: boolean;
  error: string | null;
  start(): Promise<void>;
}

/**
 * Exports the open project as a zip the user keeps; one export at a time, a failure or a note about what was left out becomes a message.
 * `save` is null while no project is open; `noteFor` turns a finished export into a message (null for none).
 */
export function useProjectZipExport<T>(save: (() => Promise<StoreResult<T>>) | null, noteFor: (outcome: T) => string | null): ProjectZipExport {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const latestNote = useRef(noteFor);
  latestNote.current = noteFor;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = useCallback(async (): Promise<void> => {
    if (save === null || running.current) return;
    running.current = true;
    setExporting(true);
    setError(null);
    let message: string | null = null;
    try {
      const result = await save();
      message = result.ok ? latestNote.current(result.value) : result.error.message;
    } catch {
      message = 'The project could not be exported.';
    }
    running.current = false;
    if (!mounted.current) return;
    setExporting(false);
    setError(message);
  }, [save]);

  return { exporting, error, start };
}
