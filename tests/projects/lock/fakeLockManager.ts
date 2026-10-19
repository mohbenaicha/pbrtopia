import type { ProjectLockManager } from '../../../src/projects/lock/acquireProjectLock';

// The part of the Web Locks API the app uses: a named lock is held until the callback's promise settles; `ifAvailable` gives null when it is taken.
export function createFakeLockManager(): ProjectLockManager & { requested: string[] } {
  const held = new Set<string>();
  const requested: string[] = [];
  return {
    requested,
    request: ((name: string, options: { ifAvailable?: boolean }, callback: (lock: object | null) => Promise<unknown>) => {
      requested.push(name);
      if (held.has(name)) {
        if (options.ifAvailable === true) return callback(null);
        return Promise.reject(new Error('the fake only grants locks that are free'));
      }
      held.add(name);
      return callback({ name }).finally(() => held.delete(name));
    }) as ProjectLockManager['request'],
  };
}
