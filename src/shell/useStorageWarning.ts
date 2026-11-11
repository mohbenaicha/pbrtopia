import { useCallback, useEffect, useRef, useState } from 'react';
import type { SharedProjectStore } from '../projects/SharedProjectStore';
import { isStorageLow, type StorageEstimate } from '../projects/storage/storageHealth';

interface StorageWarning {
  estimate: StorageEstimate | null;
  full: boolean; // a save failed for lack of space
  warn: boolean; // space is low or a save failed
  check(): Promise<void>; // reads the estimate again
  reportFull(): void;
}

// A save that ends after its view was closed (the flush on leaving a project) still reports: the next view that opens shows the warning.
let reportedFull = false;
export const clearReportedFull = (): void => {
  reportedFull = false;
};

/** Reads the storage estimate when the view opens and on `check`; the warning is on while space is low or a save has reported the browser full. */
export function useStorageWarning(store: Pick<SharedProjectStore, 'estimateStorage'>): StorageWarning {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  const [full, setFull] = useState(reportedFull);
  const mounted = useRef(true);
  const asked = useRef(0); // counts estimate requests so an older answer cannot replace a newer one

  const check = useCallback(async (): Promise<void> => {
    asked.current += 1;
    const mine = asked.current;
    const read = await store.estimateStorage();
    if (!mounted.current || mine !== asked.current) return; // gone, or a newer estimate was asked for
    setEstimate(read);
    if (read !== null && !isStorageLow(read)) {
      reportedFull = false; // room again, e.g. after a delete
      setFull(false);
    }
  }, [store]);

  useEffect(() => {
    mounted.current = true;
    void check();
    return () => {
      mounted.current = false;
    };
  }, [check]);

  const reportFull = useCallback(() => {
    reportedFull = true;
    setFull(true);
  }, []);
  return { estimate, full, warn: full || isStorageLow(estimate), check, reportFull };
}
