import { describe, expect, it } from 'vitest';
import { acquireProjectLock, type ProjectLockRequester } from '../../../src/projects/lock/acquireProjectLock';
import { createFakeLockManager } from './fakeLockManager';

describe('acquireProjectLock', () => {
  it('R4 the first tab holds a project and a second is not held until the first lets go', async () => {
    const locks = createFakeLockManager();
    const first = await acquireProjectLock('p1', locks);
    expect(first.held).toBe(true);
    const second = await acquireProjectLock('p1', locks);
    expect(second.held).toBe(false);
    first.release();
    await Promise.resolve();
    expect((await acquireProjectLock('p1', locks)).held).toBe(true);
  });

  it('R4 different projects do not block each other, and the lock is named after the project', async () => {
    const locks = createFakeLockManager();
    expect((await acquireProjectLock('a', locks)).held).toBe(true);
    expect((await acquireProjectLock('b', locks)).held).toBe(true);
    expect(locks.requested).toEqual(['project:a', 'project:b']);
  });

  it('R4 releasing twice is safe, and releasing a lock that was not held changes nothing', async () => {
    const locks = createFakeLockManager();
    const first = await acquireProjectLock('p1', locks);
    const notHeld = await acquireProjectLock('p1', locks);
    notHeld.release();
    expect((await acquireProjectLock('p1', locks)).held).toBe(false); // the first still holds it
    first.release();
    first.release();
    await Promise.resolve();
    expect((await acquireProjectLock('p1', locks)).held).toBe(true);
  });

  it('R4 a browser without Web Locks, or a request that fails, counts as held because nothing can arbitrate', async () => {
    expect((await acquireProjectLock('p1', undefined)).held).toBe(true);
    const throwing: ProjectLockRequester = { request: (() => {
      throw new Error('SecurityError');
    }) as ProjectLockRequester['request'] };
    expect((await acquireProjectLock('p1', throwing)).held).toBe(true);
    const rejecting: ProjectLockRequester = { request: (() => Promise.reject(new Error('nope'))) as ProjectLockRequester['request'] };
    const result = await acquireProjectLock('p1', rejecting);
    expect(result.held).toBe(true);
    expect(() => result.release()).not.toThrow();
  });
});
