import { useEffect, useRef, useState } from 'react';
import { acquireProjectLock, type ProjectLock } from '../projects/lock/acquireProjectLock';

type ProjectLockState ='checking' | 'held' | 'read-only';

/**
 * Holds the project's lock while its view is open: `held` means this tab may write, `read-only` means another tab has the project.
 * The lock is let go when the view closes or another project is opened.
 */
export function useProjectLock(projectId: string, acquire: (projectId: string) => Promise<ProjectLock> = acquireProjectLock): ProjectLockState {
  const [answer, setAnswer] = useState<{ projectId: string; state: 'held' | 'read-only' } | null>(null);
  const acquireRef = useRef(acquire); // a new function each render must not ask for the lock again
  acquireRef.current = acquire;

  useEffect(() => {
    let closed = false;
    let lock: ProjectLock | undefined;
    void acquireRef.current(projectId).then(
      (acquired) => {
        lock = acquired;
        if (closed) acquired.release();
        else setAnswer({ projectId, state: acquired.held ? 'held' : 'read-only' });
      },
      () => {
        if (!closed) setAnswer({ projectId, state: 'held' }); // the lock could not be asked for, so nothing can say another tab has it
      },
    );
    return () => {
      closed = true;
      lock?.release();
    };
  }, [projectId]);

  return answer !== null && answer.projectId === projectId ? answer.state : 'checking';
}
