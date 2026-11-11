import { projectStoreNames } from '../../appId';

export type ProjectLockRequester = Pick<LockManager, 'request'>;

export interface ProjectLock {
  held: boolean; // false: another tab holds this project, so open it read-only
  release(): void;
}

const NOT_HELD: ProjectLock = { held: false, release: () => undefined };

// One writer per project: the Web Lock `project:<id>` is kept until release() or the tab closes. Where there is no Web Locks, or it fails, nothing can arbitrate, so the project counts as held.
export async function acquireProjectLock(projectId: string, locks: ProjectLockRequester | undefined = typeof navigator === 'undefined' ? undefined : navigator.locks, appId?: string): Promise<ProjectLock> {
  const lockName = projectStoreNames(appId).lockName(projectId);
  if (locks === undefined) return { held: true, release: () => undefined };
  return new Promise<ProjectLock>((resolve) => {
    let release: () => void = () => undefined;
    const holdUntilReleased = new Promise<void>((done) => {
      release = done;
    });
    const hold: ProjectLock = { held: true, release: () => release() };
    try {
      locks
        .request(lockName, { ifAvailable: true }, (lock) => {
          if (lock === null) {
            resolve(NOT_HELD);
            return undefined;
          }
          resolve(hold);
          return holdUntilReleased;
        })
        .catch(() => resolve(hold));
    } catch {
      resolve(hold);
    }
  });
}
