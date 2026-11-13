import { describe, expect, it, vi } from 'vitest';
import { StoreAbort, storeFailure } from '../../src/projects';
import { createDesktopRecordEngine } from '../../src/storage-desktop/DesktopRecordEngine';
import type { RecordOp } from '../../src/storage-desktop/RecordBridge';
import { createMemoryRecordBridge } from '../support/storageDesktop/memoryRecordBridge';

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const put = (key: string, value: Uint8Array, indexes: { parent?: string; sort?: string } = {}): RecordOp => ({ op: 'put', collection: 'c', key, value, ...indexes });

/** An engine over a bridge that already holds these records. */
async function engineWith(ops: RecordOp[] = [], options?: { maxBatchBytes: number }) {
  const bridge = createMemoryRecordBridge();
  if (ops.length > 0) await bridge.commit(ops);
  const commit = vi.spyOn(bridge, 'commit');
  return { bridge, commit, engine: createDesktopRecordEngine(bridge, options) };
}

const keysOf = (entries: { key: string }[]): string[] => entries.map((entry) => entry.key);

describe('createDesktopRecordEngine commit (storage-backends R7)', () => {
  it('R7 a writing run keeps its writes in the page until the work ends, then sends them as one commit in the order made', async () => {
    const { bridge, commit, engine } = await engineWith();
    const result = await engine.run('readwrite', async (tx) => {
      await tx.put('c', 'a', bytes(1));
      await tx.put('c', 'b', bytes(2), { parent: 'p', sort: 's' });
      await tx.remove('c', 'a');
      expect(await bridge.get('c', 'b')).toBeNull(); // not sent yet
      expect(commit).not.toHaveBeenCalled();
      return 'done';
    });
    expect(result).toEqual({ ok: true, value: 'done' });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]![0]).toEqual([
      { op: 'put', collection: 'c', key: 'a', value: bytes(1) },
      { op: 'put', collection: 'c', key: 'b', parent: 'p', sort: 's', value: bytes(2) },
      { op: 'remove', collection: 'c', key: 'a' },
    ]);
    expect(await bridge.get('c', 'a')).toBeNull();
    expect(await bridge.get('c', 'b')).toEqual(bytes(2));
  });

  it('R7 a run that wrote nothing sends no commit', async () => {
    const { commit, engine } = await engineWith([put('a', bytes(1))]);
    await engine.run('readwrite', async (tx) => tx.get('c', 'a'));
    await engine.run('readonly', async (tx) => tx.get('c', 'a'));
    expect(commit).not.toHaveBeenCalled();
  });

  it('R7 work that throws writes nothing: a StoreAbort comes back as its own error, anything else as "storage-unavailable"', async () => {
    const { bridge, commit, engine } = await engineWith();
    const aborted = await engine.run('readwrite', async (tx) => {
      await tx.put('c', 'a', bytes(1));
      throw new StoreAbort(storeFailure('not-found', 'That project no longer exists.').error);
    });
    expect(aborted).toEqual(storeFailure('not-found', 'That project no longer exists.'));
    const broken = await engine.run('readwrite', async (tx) => {
      await tx.put('c', 'a', bytes(1));
      throw new Error('boom');
    });
    expect(broken).toMatchObject({ ok: false, error: { code: 'storage-unavailable' } });
    expect(commit).not.toHaveBeenCalled();
    expect(await bridge.get('c', 'a')).toBeNull();
  });

  it('R7 a commit the store refuses changes nothing and comes back as the matching store error', async () => {
    const { bridge, engine } = await engineWith([put('a', bytes(1))]);
    bridge.failNextCommit('no-space');
    const full = await engine.run('readwrite', async (tx) => tx.put('c', 'b', bytes(2)));
    expect(full).toMatchObject({ ok: false, error: { code: 'quota-exceeded' } });
    bridge.failNextCommit('denied');
    const denied = await engine.run('readwrite', async (tx) => tx.remove('c', 'a'));
    expect(denied).toMatchObject({ ok: false, error: { code: 'storage-unavailable' } });
    expect(await bridge.get('c', 'b')).toBeNull();
    expect(await bridge.get('c', 'a')).toEqual(bytes(1));
  });

  it('R7 a batch larger than the limit is refused with "quota-exceeded" before anything is sent', async () => {
    const { commit, engine } = await engineWith([], { maxBatchBytes: 10 });
    const result = await engine.run('readwrite', async (tx) => {
      await tx.put('c', 'a', new Uint8Array(6));
      await tx.put('c', 'b', new Uint8Array(6));
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'quota-exceeded' } });
    expect(commit).not.toHaveBeenCalled();
  });
});

describe('createDesktopRecordEngine concurrency (storage-backends R7)', () => {
  it('R7 writing runs go one at a time in the order asked, even when the first fails', async () => {
    const { engine } = await engineWith();
    const log: string[] = [];
    let releaseFirst!: () => void;
    const firstMayEnd = new Promise<void>((resolve) => void (releaseFirst = resolve));
    const first = engine.run('readwrite', async () => {
      log.push('first start');
      await firstMayEnd;
      log.push('first end');
      throw new Error('first fails');
    });
    const second = engine.run('readwrite', async () => void log.push('second'));
    const third = engine.run('readwrite', async () => void log.push('third'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(log).toEqual(['first start']); // the others wait
    releaseFirst();
    const results = await Promise.all([first, second, third]);
    expect(log).toEqual(['first start', 'first end', 'second', 'third']);
    expect(results.map((result) => result.ok)).toEqual([false, true, true]);
  });

  it('R7 a reading run is not held up by an open writing run and sees only what is committed', async () => {
    const { engine } = await engineWith([put('a', bytes(1))]);
    let readInside: Uint8Array | null | undefined;
    await engine.run('readwrite', async (tx) => {
      await tx.put('c', 'a', bytes(9));
      await tx.put('c', 'b', bytes(2));
      const seen = await engine.run('readonly', async (reader) => ({ a: await reader.get('c', 'a'), b: await reader.get('c', 'b') }));
      expect(seen).toEqual({ ok: true, value: { a: bytes(1), b: null } });
      readInside = await tx.get('c', 'b');
    });
    expect(readInside).toEqual(bytes(2));
    const after = await engine.run('readonly', async (reader) => reader.get('c', 'a'));
    expect(after).toEqual({ ok: true, value: bytes(9) });
  });

  it('R7 a reading run cannot write', async () => {
    const { commit, engine } = await engineWith();
    const result = await engine.run('readonly', async (tx) => tx.put('c', 'a', bytes(1)));
    expect(result).toMatchObject({ ok: false, error: { code: 'storage-unavailable' } });
    expect(commit).not.toHaveBeenCalled();
  });

  it('R7 a transaction used after its run ended is refused, so work that awaited something else cannot write late', async () => {
    const { commit, engine } = await engineWith();
    let late: (() => Promise<void>) | undefined;
    await engine.run('readwrite', async (tx) => void (late = () => tx.put('c', 'x', bytes(1))));
    await expect(late!()).rejects.toThrow();
    expect(commit).not.toHaveBeenCalled();
  });
});

describe('createDesktopRecordEngine reads inside a writing run (storage-backends R7)', () => {
  it('R7 get sees the run\'s own puts and removes', async () => {
    const { engine } = await engineWith([put('a', bytes(1)), put('b', bytes(2))]);
    const result = await engine.run('readwrite', async (tx) => {
      await tx.put('c', 'a', bytes(7));
      await tx.remove('c', 'b');
      await tx.put('c', 'n', bytes(5));
      return [await tx.get('c', 'a'), await tx.get('c', 'b'), await tx.get('c', 'n'), await tx.get('c', 'none')];
    });
    expect(result).toEqual({ ok: true, value: [bytes(7), null, bytes(5), null] });
  });

  it('R4 list by parent merges the run\'s writes: new members in, removed ones out, moved ones follow their new parent', async () => {
    const { engine } = await engineWith([put('s1', bytes(1), { parent: 'p1' }), put('s2', bytes(2), { parent: 'p1' }), put('s3', bytes(3), { parent: 'p2' })]);
    const result = await engine.run('readwrite', async (tx) => {
      await tx.put('c', 's0', bytes(0), { parent: 'p1' });
      await tx.remove('c', 's2');
      await tx.put('c', 's3', bytes(3), { parent: 'p1' });
      await tx.put('c', 's1', bytes(1), { parent: 'p2' });
      return { p1: keysOf(await tx.list('c', { by: 'parent', parent: 'p1' })), p2: keysOf(await tx.list('c', { by: 'parent', parent: 'p2' })) };
    });
    expect(result).toEqual({ ok: true, value: { p1: ['s0', 's3'], p2: ['s1'] } });
  });

  it('R4 list by sort merges the run\'s writes into the newest-first order, ties by key largest first', async () => {
    const { engine } = await engineWith([put('a', bytes(1), { sort: '2026-01' }), put('b', bytes(2), { sort: '2026-03' }), put('c', bytes(3), { sort: '2026-02' })]);
    const result = await engine.run('readwrite', async (tx) => {
      await tx.put('c', 'a', bytes(1), { sort: '2026-04' }); // touched: moves to the top
      await tx.put('c', 'd', bytes(4), { sort: '2026-03' }); // ties with b
      await tx.put('c', 'e', bytes(5)); // no sort: not listed
      await tx.remove('c', 'c');
      return keysOf(await tx.list('c', { by: 'sortDescending' }));
    });
    expect(result).toEqual({ ok: true, value: ['a', 'd', 'b'] });
  });

  it('R4 removeByParent takes out the committed members and those the run put, but not ones the run moved elsewhere', async () => {
    const { bridge, engine } = await engineWith([put('t1', bytes(1), { parent: 's1' }), put('t2', bytes(2), { parent: 's1' }), put('t9', bytes(9), { parent: 's2' })]);
    const result = await engine.run('readwrite', async (tx) => {
      await tx.put('c', 't3', bytes(3), { parent: 's1' });
      await tx.put('c', 't2', bytes(2), { parent: 's2' }); // moved away first
      await tx.removeByParent('c', 's1');
      return { s1: keysOf(await tx.list('c', { by: 'parent', parent: 's1' })), t1: await tx.get('c', 't1'), t3: await tx.get('c', 't3'), t2: await tx.get('c', 't2') };
    });
    expect(result).toEqual({ ok: true, value: { s1: [], t1: null, t3: null, t2: bytes(2) } });
    expect(keysOf(await bridge.list('c', { by: 'parent', parent: 's1' }))).toEqual([]);
    expect(keysOf(await bridge.list('c', { by: 'parent', parent: 's2' }))).toEqual(['t2', 't9']);
  });

  it('R7 a record put again without a parent or sort loses them, as a replaced record would', async () => {
    const { engine } = await engineWith([put('a', bytes(1), { parent: 'p', sort: 's' })]);
    const result = await engine.run('readwrite', async (tx) => {
      await tx.put('c', 'a', bytes(2));
      return { byParent: await tx.list('c', { by: 'parent', parent: 'p' }), bySort: await tx.list('c', { by: 'sortDescending' }) };
    });
    expect(result).toEqual({ ok: true, value: { byParent: [], bySort: [] } });
  });

  it('R4 collections stay apart inside a run', async () => {
    const { engine } = await engineWith();
    const result = await engine.run('readwrite', async (tx) => {
      await tx.put('one', 'a', bytes(1));
      await tx.put('two', 'a', bytes(2));
      await tx.remove('one', 'a');
      return [await tx.get('one', 'a'), await tx.get('two', 'a')];
    });
    expect(result).toEqual({ ok: true, value: [null, bytes(2)] });
  });
});
