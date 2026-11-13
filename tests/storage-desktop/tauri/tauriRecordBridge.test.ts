import { describe, expect, it } from 'vitest';
import { BridgeError } from '../../../src/storage-desktop/bridgeError';
import { createTauriRecordBridge } from '../../../src/storage-desktop/tauri/tauriRecordBridge';
import { createFakeTauriInvoke } from '../../support/storageDesktop/fakeTauriInvoke';
import { createMemoryRecordBridge } from '../../support/storageDesktop/memoryRecordBridge';
import { createNodeFileBridge } from '../../support/storageDesktop/nodeFileBridge';

function setup() {
  const records = createMemoryRecordBridge();
  const files = createNodeFileBridge('.');
  const fake = createFakeTauriInvoke({ records, library: files, appdata: files });
  return { bridge: createTauriRecordBridge(fake.invoke), fake, records };
}

describe('tauri record bridge (storage-backends R7, R8)', () => {
  it('R8 puts and gets bytes through the commit and get commands, and a missing record is null', async () => {
    const { bridge } = setup();
    await bridge.commit([{ op: 'put', collection: 'projects', key: 'p1', sort: '2026-01-01', value: Uint8Array.of(1, 2, 3) }]);
    expect([...((await bridge.get('projects', 'p1')) ?? [])]).toEqual([1, 2, 3]);
    expect(await bridge.get('projects', 'nope')).toBeNull();
  });

  it('R8 an empty value is stored and read back as empty, not as missing', async () => {
    const { bridge } = setup();
    await bridge.commit([{ op: 'put', collection: 'settings', key: 'app', value: new Uint8Array(0) }]);
    expect(await bridge.get('settings', 'app')).toEqual(new Uint8Array(0));
  });

  it('R7 lists by sort newest first and by parent, with the indexed keys and bytes', async () => {
    const { bridge } = setup();
    await bridge.commit([
      { op: 'put', collection: 'projects', key: 'a', sort: '2026-01-01', value: Uint8Array.of(1) },
      { op: 'put', collection: 'projects', key: 'b', sort: '2026-02-01', value: Uint8Array.of(2) },
      { op: 'put', collection: 'sets', key: 's1', parent: 'a', value: Uint8Array.of(3) },
      { op: 'put', collection: 'sets', key: 's2', parent: 'b', value: Uint8Array.of(4) },
    ]);
    const bySort = await bridge.list('projects', { by: 'sortDescending' });
    expect(bySort.map((entry) => [entry.key, entry.sort, [...entry.value]])).toEqual([['b', '2026-02-01', [2]], ['a', '2026-01-01', [1]]]);
    const byParent = await bridge.list('sets', { by: 'parent', parent: 'a' });
    expect(byParent.map((entry) => [entry.key, entry.parent, [...entry.value]])).toEqual([['s1', 'a', [3]]]);
  });

  it('R7 removes one record and a parent\'s records in a commit', async () => {
    const { bridge } = setup();
    await bridge.commit([
      { op: 'put', collection: 'projects', key: 'a', sort: '1', value: Uint8Array.of(1) },
      { op: 'put', collection: 'sets', key: 's1', parent: 'a', value: Uint8Array.of(2) },
      { op: 'put', collection: 'sets', key: 's2', parent: 'a', value: Uint8Array.of(3) },
    ]);
    await bridge.commit([{ op: 'remove', collection: 'projects', key: 'a' }, { op: 'removeByParent', collection: 'sets', parent: 'a' }]);
    expect(await bridge.get('projects', 'a')).toBeNull();
    expect(await bridge.list('sets', { by: 'parent', parent: 'a' })).toEqual([]);
  });

  it('R8 the commit goes as one raw body (bytes), never as JSON arguments', async () => {
    const { bridge, fake } = setup();
    await bridge.commit([{ op: 'put', collection: 'projects', key: 'p1', value: Uint8Array.of(5) }]);
    const call = fake.calls.find((entry) => entry.command === 'db_commit')!;
    expect(call.args).toBeInstanceOf(Uint8Array);
  });

  it('R9 a failure from the Rust side reaches the caller as a BridgeError of the same kind', async () => {
    const { bridge, records } = setup();
    records.failNextCommit('no-space');
    await expect(bridge.commit([{ op: 'remove', collection: 'projects', key: 'a' }])).rejects.toMatchObject({ name: 'BridgeError', kind: 'no-space' });
    await expect(bridge.commit([{ op: 'remove', collection: 'projects', key: 'a' }])).resolves.toBeUndefined();
  });

  it('R9 a raw rejection (a string, an unknown shape) becomes an io BridgeError', async () => {
    const bridge = createTauriRecordBridge(() => Promise.reject('C:\\somewhere failed'));
    const error = await bridge.get('projects', 'a').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BridgeError);
    expect((error as BridgeError).kind).toBe('io');
  });
});
