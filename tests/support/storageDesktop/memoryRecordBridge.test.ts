import { describe, expect, it } from 'vitest';
import { BridgeError } from '../../../src/storage-desktop/bridgeError';
import { createMemoryRecordBridge } from './memoryRecordBridge';

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);

describe('createMemoryRecordBridge (a faithful stand-in for the Rust record store, storage-backends R7)', () => {
  it('R7 a committed put is read back as a copy, and a missing key is null', async () => {
    const bridge = createMemoryRecordBridge();
    const value = bytes(1, 2, 3);
    await bridge.commit([{ op: 'put', collection: 'projects', key: 'a', value }]);
    value[0] = 9; // the caller's array is not shared
    const read = await bridge.get('projects', 'a');
    expect([...read!]).toEqual([1, 2, 3]);
    read![1] = 9; // nor is the returned one
    expect([...(await bridge.get('projects', 'a'))!]).toEqual([1, 2, 3]);
    expect(await bridge.get('projects', 'missing')).toBeNull();
    expect(await bridge.get('sets', 'a')).toBeNull();
  });

  it('R7 a batch is all-or-none: an injected failure changes nothing, and only the next commit fails', async () => {
    const bridge = createMemoryRecordBridge();
    await bridge.commit([{ op: 'put', collection: 'projects', key: 'a', value: bytes(1) }]);
    bridge.failNextCommit('no-space');
    await expect(
      bridge.commit([
        { op: 'put', collection: 'projects', key: 'b', value: bytes(2) },
        { op: 'remove', collection: 'projects', key: 'a' },
      ]),
    ).rejects.toMatchObject({ kind: 'no-space' });
    expect(await bridge.get('projects', 'b')).toBeNull();
    expect(await bridge.get('projects', 'a')).not.toBeNull();
    await bridge.commit([{ op: 'put', collection: 'projects', key: 'b', value: bytes(2) }]);
    expect(await bridge.get('projects', 'b')).not.toBeNull();
  });

  it('R7 an op the store cannot take (a value that is not bytes) fails the whole batch', async () => {
    const bridge = createMemoryRecordBridge();
    const bad = { op: 'put', collection: 'projects', key: 'b', value: 'text' } as never;
    await expect(bridge.commit([{ op: 'put', collection: 'projects', key: 'a', value: bytes(1) }, bad])).rejects.toBeInstanceOf(BridgeError);
    expect(await bridge.get('projects', 'a')).toBeNull();
  });

  it('R7 ops run in order: a put then a remove of the same key leaves nothing, a remove then a put leaves the value', async () => {
    const bridge = createMemoryRecordBridge();
    await bridge.commit([
      { op: 'put', collection: 'projects', key: 'a', value: bytes(1) },
      { op: 'remove', collection: 'projects', key: 'a' },
      { op: 'remove', collection: 'projects', key: 'b' },
      { op: 'put', collection: 'projects', key: 'b', value: bytes(2) },
    ]);
    expect(await bridge.get('projects', 'a')).toBeNull();
    expect([...(await bridge.get('projects', 'b'))!]).toEqual([2]);
  });

  it('R4 listing by sort comes newest first like the IndexedDB index read backwards, ties by key descending, records without a sort left out', async () => {
    const bridge = createMemoryRecordBridge();
    await bridge.commit([
      { op: 'put', collection: 'projects', key: 'a', sort: '2026-01-01', value: bytes(1) },
      { op: 'put', collection: 'projects', key: 'b', sort: '2026-03-01', value: bytes(2) },
      { op: 'put', collection: 'projects', key: 'c', sort: '2026-03-01', value: bytes(3) },
      { op: 'put', collection: 'projects', key: 'd', value: bytes(4) },
    ]);
    const listed = await bridge.list('projects', { by: 'sortDescending' });
    expect(listed.map((entry) => entry.key)).toEqual(['c', 'b', 'a']);
  });

  it('R4 listing by parent gives that parent\'s records by key; a put with another parent moves the record', async () => {
    const bridge = createMemoryRecordBridge();
    await bridge.commit([
      { op: 'put', collection: 'sets', key: 's2', parent: 'p1', value: bytes(2) },
      { op: 'put', collection: 'sets', key: 's1', parent: 'p1', value: bytes(1) },
      { op: 'put', collection: 'sets', key: 's3', parent: 'p2', value: bytes(3) },
    ]);
    expect((await bridge.list('sets', { by: 'parent', parent: 'p1' })).map((entry) => entry.key)).toEqual(['s1', 's2']);
    await bridge.commit([{ op: 'put', collection: 'sets', key: 's1', parent: 'p2', value: bytes(1) }]);
    expect((await bridge.list('sets', { by: 'parent', parent: 'p1' })).map((entry) => entry.key)).toEqual(['s2']);
    expect((await bridge.list('sets', { by: 'parent', parent: 'p2' })).map((entry) => entry.key)).toEqual(['s1', 's3']);
  });

  it('R4 removeByParent removes the records of that parent, including ones put earlier in the same batch, and no others', async () => {
    const bridge = createMemoryRecordBridge();
    await bridge.commit([
      { op: 'put', collection: 'brushTiles', key: 't1', parent: 's1', value: bytes(1) },
      { op: 'put', collection: 'brushTiles', key: 't2', parent: 's2', value: bytes(2) },
    ]);
    await bridge.commit([
      { op: 'put', collection: 'brushTiles', key: 't3', parent: 's1', value: bytes(3) },
      { op: 'removeByParent', collection: 'brushTiles', parent: 's1' },
    ]);
    expect((await bridge.list('brushTiles', { by: 'parent', parent: 's1' })).length).toBe(0);
    expect((await bridge.list('brushTiles', { by: 'parent', parent: 's2' })).length).toBe(1);
  });

  it('R4 every listed record carries its parent and sort, so a caller can merge its own pending writes into the order', async () => {
    const bridge = createMemoryRecordBridge();
    await bridge.commit([
      { op: 'put', collection: 'sets', key: 's1', parent: 'p1', sort: 'x', value: bytes(1) },
      { op: 'put', collection: 'sets', key: 's2', value: bytes(2) },
    ]);
    const byParent = await bridge.list('sets', { by: 'parent', parent: 'p1' });
    expect(byParent).toEqual([{ key: 's1', parent: 'p1', sort: 'x', value: bytes(1) }]);
    const bySort = await bridge.list('sets', { by: 'sortDescending' });
    expect(bySort).toEqual([{ key: 's1', parent: 'p1', sort: 'x', value: bytes(1) }]);
  });

  it('R4 collections are separate: the same key in two collections is two records', async () => {
    const bridge = createMemoryRecordBridge();
    await bridge.commit([
      { op: 'put', collection: 'projects', key: 'a', value: bytes(1) },
      { op: 'put', collection: 'thumbnails', key: 'a', value: bytes(2) },
    ]);
    await bridge.commit([{ op: 'remove', collection: 'projects', key: 'a' }]);
    expect(await bridge.get('projects', 'a')).toBeNull();
    expect([...(await bridge.get('thumbnails', 'a'))!]).toEqual([2]);
  });
});
