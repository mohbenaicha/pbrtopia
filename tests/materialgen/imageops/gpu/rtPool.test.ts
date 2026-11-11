import { describe, expect, it } from 'vitest';
import { createRtPool } from '../../../../src/materialgen/imageops/gpu/rtPool';

function fakePool() {
  const created: { id: number; key: string; disposed: boolean; dispose(): void }[] = [];
  const pool = createRtPool((format, width, height) => {
    const target = { id: created.length, key: `${format}:${width}x${height}`, disposed: false, dispose() { target.disposed = true; } };
    created.push(target);
    return target;
  });
  return { pool, created };
}

describe('imageops render-target pool (R7, R8)', () => {
  it('R8 a target is allocated on first use and counted as live while leased', () => {
    const { pool, created } = fakePool();
    const lease = pool.acquire('rgba16f', 512, 512);
    expect(created).toHaveLength(1);
    expect(pool.liveCount()).toBe(1);
    lease.release();
    expect(pool.liveCount()).toBe(0);
  });

  it('R8 a released target is reused for the same format and size', () => {
    const { pool, created } = fakePool();
    pool.acquire('rgba8', 256, 256).release();
    const again = pool.acquire('rgba8', 256, 256);
    expect(created).toHaveLength(1);
    expect(again.target).toBe(created[0]);
  });

  it('R8 a live target is never handed out twice; a second lease of the same key allocates another', () => {
    const { pool, created } = fakePool();
    const first = pool.acquire('rgba16f', 128, 128);
    const second = pool.acquire('rgba16f', 128, 128);
    expect(first.target).not.toBe(second.target);
    expect(created).toHaveLength(2);
    expect(pool.liveCount()).toBe(2);
  });

  it('R8 a different format or size is a different target', () => {
    const { pool, created } = fakePool();
    pool.acquire('rgba8', 128, 128).release();
    pool.acquire('r8', 128, 128).release();
    pool.acquire('rgba8', 256, 128).release();
    expect(created).toHaveLength(3);
  });

  it('R7 fifty acquire and release rounds in one session do not grow the pool', () => {
    const { pool, created } = fakePool();
    const before = pool.liveCount();
    for (let round = 0; round < 50; round += 1) {
      const temp = pool.acquire('rgba8', 1024, 1024);
      const a = pool.acquire('rgba16f', 1024, 1024);
      const b = pool.acquire('rgba16f', 1024, 1024);
      b.release();
      a.release();
      temp.release();
    }
    expect(created).toHaveLength(3);
    expect(pool.liveCount()).toBe(before);
  });

  it('R8 releasing a lease twice is harmless', () => {
    const { pool } = fakePool();
    const lease = pool.acquire('rgba8', 64, 64);
    lease.release();
    lease.release();
    expect(pool.liveCount()).toBe(0);
    const first = pool.acquire('rgba8', 64, 64);
    const second = pool.acquire('rgba8', 64, 64);
    expect(first.target).not.toBe(second.target);
  });

  it('R8 dispose frees every target, leased or cached, and refuses new leases', () => {
    const { pool, created } = fakePool();
    pool.acquire('rgba8', 64, 64).release();
    pool.acquire('r8', 64, 64);
    pool.dispose();
    expect(created.every((target) => target.disposed)).toBe(true);
    expect(pool.liveCount()).toBe(0);
    expect(() => pool.acquire('rgba8', 64, 64)).toThrow(/closed/);
  });
});
