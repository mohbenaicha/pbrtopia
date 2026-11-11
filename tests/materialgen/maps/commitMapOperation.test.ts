import { describe, expect, it, vi } from 'vitest';
import { storeFailure, type StoreResult } from '../../../src/projects';
import { commitMapOperation, quotaMessage, type MapCommitPorts } from '../../../src/materialgen/maps/commitMapOperation';
import { editMaps, placeMap } from '../../../src/materialgen/maps/mapOperations';
import type { MapsState } from '../../../src/materialgen/maps';

const ok: StoreResult<void> = { ok: true, value: undefined };
const empty: MapsState = { size: null, maps: {} };
const before = (): MapsState => editMaps(placeMap(empty, 'albedo', { originalKey: 'a1', workingKey: 'a1', width: 1024, height: 1024 }), [{ kind: 'albedo', workingKey: 'a2' }], 'Filter');
const blob = (size: number): Blob => new Blob([new Uint8Array(size)]);

function ports(overrides: Partial<MapCommitPorts> = {}) {
  const calls: string[] = [];
  const full: MapCommitPorts = {
    writeBlob: vi.fn(async (key) => (calls.push(`write ${key}`), ok)),
    deleteBlob: vi.fn(async (key) => (calls.push(`delete ${key}`), ok)),
    commit: vi.fn(async () => (calls.push('commit'), ok)),
    estimateFreeBytes: vi.fn(async () => null),
    ...overrides,
  };
  return { calls, ports: full };
}

describe('materialgen/maps R29 commitMapOperation order', () => {
  it('R29 writes the new blobs, commits the record, then deletes what nothing references any more', async () => {
    const { calls, ports: p } = ports();
    const start = before();
    const next = editMaps(start, [{ kind: 'albedo', workingKey: 'a3' }], 'Blur'); // a2 becomes the undo, a1 stays the original
    const result = await commitMapOperation({ before: start, next, newBlobs: new Map([['a3', blob(10)]]), otherReferencedKeys: new Set(), ports: p });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(['write a3', 'commit']);
  });

  it('R29 a replaced undo copy is deleted after the commit', async () => {
    const { calls, ports: p } = ports();
    let start = before();
    start = editMaps(start, [{ kind: 'albedo', workingKey: 'a3' }], 'Blur'); // keys a1, a2, a3; undo a2
    const next = editMaps(start, [{ kind: 'albedo', workingKey: 'a4' }], 'Blur again'); // undo a3; a2 is freed
    await commitMapOperation({ before: start, next, newBlobs: new Map([['a4', blob(10)]]), otherReferencedKeys: new Set(), ports: p });
    expect(calls).toEqual(['write a4', 'commit', 'delete a2']);
  });

  it('R28 a key another field of the record still references is not deleted', async () => {
    const { calls, ports: p } = ports();
    let start = before();
    start = editMaps(start, [{ kind: 'albedo', workingKey: 'a3' }], 'Blur');
    const next = editMaps(start, [{ kind: 'albedo', workingKey: 'a4' }], 'Blur again');
    await commitMapOperation({ before: start, next, newBlobs: new Map([['a4', blob(10)]]), otherReferencedKeys: new Set(['a2']), ports: p });
    expect(calls).toEqual(['write a4', 'commit']);
  });
});

describe('materialgen/maps R29 R31 failures', () => {
  it('R29 a failed write stops the operation, deletes what it already wrote and commits nothing', async () => {
    let writes = 0;
    const { calls, ports: p } = ports({
      writeBlob: vi.fn(async (key) => {
        calls.push(`write ${key}`);
        return (writes += 1) === 2 ? storeFailure('storage-unavailable', 'Disk error.') : ok;
      }),
    });
    const start = before();
    const next = editMaps(start, [{ kind: 'albedo', workingKey: 'a3' }], 'Blur');
    const result = await commitMapOperation({ before: start, next, newBlobs: new Map([['a3', blob(1)], ['x', blob(1)]]), otherReferencedKeys: new Set(), ports: p });
    expect(result).toEqual(storeFailure('storage-unavailable', 'Disk error.'));
    expect(calls).toEqual(['write a3', 'write x', 'delete a3']);
  });

  it('R29 a failed commit deletes every blob the operation wrote', async () => {
    const { calls, ports: p } = ports({ commit: vi.fn(async () => storeFailure('aborted', 'Could not save.')) });
    const start = before();
    const next = editMaps(start, [{ kind: 'albedo', workingKey: 'a3' }], 'Blur');
    const result = await commitMapOperation({ before: start, next, newBlobs: new Map([['a3', blob(1)]]), otherReferencedKeys: new Set(), ports: p });
    expect(result.ok).toBe(false);
    expect(calls).toEqual(['write a3', 'delete a3']);
  });

  it('R31 a failed delete after the commit is not an error', async () => {
    const { ports: p } = ports({ deleteBlob: vi.fn(async () => storeFailure('storage-unavailable', 'x')) });
    let start = before();
    start = editMaps(start, [{ kind: 'albedo', workingKey: 'a3' }], 'Blur');
    const next = editMaps(start, [{ kind: 'albedo', workingKey: 'a4' }], 'Blur again');
    const result = await commitMapOperation({ before: start, next, newBlobs: new Map([['a4', blob(1)]]), otherReferencedKeys: new Set(), ports: p });
    expect(result.ok).toBe(true);
  });

  it('R29 a thrown error from a port ends the operation like a failure', async () => {
    const { ports: p } = ports({ writeBlob: vi.fn(async () => Promise.reject(new Error('boom'))) });
    const start = before();
    const result = await commitMapOperation({ before: start, next: editMaps(start, [{ kind: 'albedo', workingKey: 'a3' }], 'Blur'), newBlobs: new Map([['a3', blob(1)]]), otherReferencedKeys: new Set(), ports: p });
    expect(result.ok).toBe(false);
  });
});

describe('materialgen/maps R67 R68 R69 quota', () => {
  const run = (free: number | null, sizes: number[], overrides: Partial<MapCommitPorts> = {}) => {
    const { calls, ports: p } = ports({ estimateFreeBytes: vi.fn(async () => free), ...overrides });
    const start = before();
    const next = editMaps(start, [{ kind: 'albedo', workingKey: 'a3' }], 'Blur');
    const newBlobs = new Map(sizes.map((size, index) => [index === 0 ? 'a3' : `x${index}`, blob(size)]));
    return { calls, result: commitMapOperation({ before: start, next, newBlobs, otherReferencedKeys: new Set(), ports: p }) };
  };

  it('R67 free space that exceeds the new blobs by 5% lets the operation run', async () => {
    const { result } = run(1100, [1000]);
    expect((await result).ok).toBe(true);
  });

  it('R67 too little free space writes and commits nothing and says how much is needed and free', async () => {
    const { calls, result } = run(1040, [1000]);
    const outcome = await result;
    expect(outcome).toEqual(storeFailure('quota-exceeded', quotaMessage(1000, 1040)));
    expect(calls).toEqual([]);
  });

  it('R67 an unavailable estimate skips the check', async () => {
    const { result } = run(null, [10_000_000]);
    expect((await result).ok).toBe(true);
  });

  it('R69 the check covers the total of all new blobs of the operation', async () => {
    const { calls, result } = run(2500, [1000, 1000, 1000]);
    expect((await result).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('R68 a quota error raised by a write gets the same message and nothing is committed', async () => {
    const { calls, result } = run(null, [3_145_728], { writeBlob: vi.fn(async () => storeFailure('quota-exceeded', 'raw')) });
    const outcome = await result;
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.error.message).toBe('Not enough storage: about 3.0 MB needed. Free space in Settings > Storage.');
    expect(calls).toEqual([]);
  });

  it('R67 the message names megabytes with one decimal', () => {
    expect(quotaMessage(5_242_880, 1_048_576)).toBe('Not enough storage: about 5.0 MB needed, 1.0 MB free. Free space in Settings > Storage.');
  });
});
