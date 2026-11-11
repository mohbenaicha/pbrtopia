import { useCallback, useEffect, useRef, useState } from 'react';
import type { SharedProjectStore } from '../../projects/SharedProjectStore';
import { forgetOpenProject } from '../openProjectMemory';

type PurgeStore = Pick<SharedProjectStore, 'listProjects' | 'deleteProjects' | 'saveAppSettings'>;

export interface ProjectPurge {
  checking: boolean; // the project list is being read
  asking: number | null; // how many projects the open dialog would delete; null when it is closed
  deleting: boolean;
  progress: { done: number; total: number } | null;
  message: string | null; // the last result or failure, shown in the Usage group
  ask(): Promise<void>;
  confirm(): Promise<void>;
  cancel(): void;
}

const describeRemaining = (count: number): string => (count === 1 ? '1 project remains.' : `${count} projects remain.`);

/** Settings R13: Delete all data. Reads the project list, asks, then deletes every listed project; `onDone` runs after any attempt (the usage is read again). */
export function usePurgeAllProjects(store: PurgeStore, onDone: () => Promise<void>): ProjectPurge {
  const [checking, setChecking] = useState(false);
  const [ids, setIds] = useState<string[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false); // a list read or a delete is running: a second click does nothing
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const ask = useCallback(async (): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    setMessage(null);
    const listed = await store.listProjects();
    busy.current = false;
    setChecking(false);
    if (!listed.ok) setMessage(listed.error.message);
    else if (listed.value.length === 0) setMessage('There are no projects to delete.');
    else setIds(listed.value.map((project) => project.id));
  }, [store]);

  const confirm = useCallback(async (): Promise<void> => {
    if (busy.current || ids === null) return;
    busy.current = true;
    let done = 0;
    setProgress({ done, total: ids.length });
    const outcome = await store.deleteProjects(ids, (finished, total) => {
      done = finished;
      setProgress({ done: finished, total });
    });
    if (done > 0 || outcome.ok) await forgetOpenProject(store);
    let result: string;
    if (outcome.ok) {
      const left = await store.listProjects();
      if (!left.ok) result = left.error.message; // not "all deleted": what remains cannot be told
      else result = left.value.length > 0 ? describeRemaining(left.value.length) : 'All projects were deleted.';
    } else {
      result = done > 0 ? `Deleted ${done} of ${ids.length}. ${outcome.error.message}` : outcome.error.message;
    }
    await onDone(); // the usage is read again before the dialog closes, so a new purge cannot overlap this one
    if (mounted.current) {
      setMessage(result);
      setIds(null);
      setProgress(null);
    }
    busy.current = false;
  }, [store, ids, onDone]);

  const cancel = useCallback((): void => {
    if (!busy.current) setIds(null);
  }, []);

  return { checking, asking: ids === null ? null : ids.length, deleting: progress !== null, progress, message, ask, confirm, cancel };
}
