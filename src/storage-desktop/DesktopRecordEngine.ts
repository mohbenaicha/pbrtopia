import { StoreAbort, storeFailure, type StoreResult } from '../projects';
import { storeFailureFromBridge } from './bridgeFailure';
import type { RecordBridge, RecordEntry, RecordOp, RecordQuery } from './RecordBridge';

export const DEFAULT_MAX_BATCH_BYTES = 256 * 1024 * 1024;

/** Typed bytes in, typed bytes out: the adapters (not the engine) know what a project or a tile is. */
export interface EngineTransaction {
  get(collection: string, key: string): Promise<Uint8Array | null>;
  /** The committed records plus this run's own writes, in the order the query names. */
  list(collection: string, query: RecordQuery): Promise<RecordEntry[]>;
  /** Replaces the whole record: a put without `parent` or `sort` leaves it without them. */
  put(collection: string, key: string, value: Uint8Array, indexes?: { parent?: string; sort?: string }): Promise<void>;
  remove(collection: string, key: string): Promise<void>;
  removeByParent(collection: string, parent: string): Promise<void>;
}

export interface DesktopRecordEngine {
  /**
   * Runs the work: a `readwrite` run holds its writes in the page and sends them as one commit when the work ends (all-or-none; nothing is sent
   * when the work throws), and runs one at a time in the order asked. A `readonly` run sees committed data only and is never held up.
   * Failures come back as values.
   */
  run<T>(mode: 'readonly' | 'readwrite', work: (tx: EngineTransaction) => Promise<T>): Promise<StoreResult<T>>;
}

type Pending = { kind: 'put'; parent: string | undefined; sort: string | undefined; value: Uint8Array } | { kind: 'remove' };

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0); // code-unit order, like IndexedDB and the store

function orderedAs(entries: RecordEntry[], query: RecordQuery): RecordEntry[] {
  if (query.by === 'parent') return entries.sort((a, b) => compare(a.key, b.key));
  return entries.sort((a, b) => compare(a.sort!, b.sort!) || compare(a.key, b.key)).reverse();
}

function openTransaction(bridge: RecordBridge, writable: boolean, maxBatchBytes: number) {
  const ops: RecordOp[] = [];
  const pending = new Map<string, Map<string, Pending>>();
  let batchBytes = 0;
  let open = true;

  const requireOpen = (): void => {
    if (!open) throw new Error('The transaction has finished.');
  };
  const requireWritable = (): void => {
    requireOpen();
    if (!writable) throw new Error('This transaction is read-only.');
  };
  const pendingIn = (collection: string): Map<string, Pending> => {
    const existing = pending.get(collection);
    if (existing !== undefined) return existing;
    const created = new Map<string, Pending>();
    pending.set(collection, created);
    return created;
  };

  async function list(collection: string, query: RecordQuery): Promise<RecordEntry[]> {
    requireOpen();
    const own = pending.get(collection);
    const kept = (await bridge.list(collection, query)).filter((entry) => own?.has(entry.key) !== true); // own writes replace or remove the committed record
    for (const [key, change] of own ?? []) {
      if (change.kind !== 'put') continue;
      if (query.by === 'parent' ? change.parent === query.parent : change.sort !== undefined) {
        kept.push({ key, ...(change.parent !== undefined && { parent: change.parent }), ...(change.sort !== undefined && { sort: change.sort }), value: change.value });
      }
    }
    return orderedAs(kept, query).map((entry) => ({ ...entry, value: entry.value.slice() }));
  }

  const transaction: EngineTransaction = {
    async get(collection, key) {
      requireOpen();
      const change = pending.get(collection)?.get(key);
      if (change === undefined) return bridge.get(collection, key);
      return change.kind === 'put' ? change.value.slice() : null;
    },
    list,
    async put(collection, key, value, indexes = {}) {
      requireWritable();
      batchBytes += value.length;
      if (batchBytes > maxBatchBytes) throw new StoreAbort(storeFailure('quota-exceeded', 'This save is too large to write in one step.').error);
      const kept = value.slice();
      ops.push({ op: 'put', collection, key, ...(indexes.parent !== undefined && { parent: indexes.parent }), ...(indexes.sort !== undefined && { sort: indexes.sort }), value: kept });
      pendingIn(collection).set(key, { kind: 'put', parent: indexes.parent, sort: indexes.sort, value: kept });
    },
    async remove(collection, key) {
      requireWritable();
      ops.push({ op: 'remove', collection, key });
      pendingIn(collection).set(key, { kind: 'remove' });
    },
    async removeByParent(collection, parent) {
      requireWritable();
      const members = await list(collection, { by: 'parent', parent }); // resolved now, against committed data and this run's writes
      ops.push({ op: 'removeByParent', collection, parent });
      for (const member of members) pendingIn(collection).set(member.key, { kind: 'remove' });
    },
  };
  return { transaction, ops, close: (): void => void (open = false) };
}

/** Storage-backends R7: transactions over the record store of the desktop side, with the guarantees the IndexedDB seams promise. */
export function createDesktopRecordEngine(bridge: RecordBridge, options: { maxBatchBytes?: number } = {}): DesktopRecordEngine {
  const maxBatchBytes = options.maxBatchBytes ?? DEFAULT_MAX_BATCH_BYTES;
  let queueTail: Promise<void> = Promise.resolve();

  async function exclusively<T>(work: () => Promise<T>): Promise<T> {
    const before = queueTail;
    let release!: () => void;
    queueTail = new Promise<void>((resolve) => void (release = resolve));
    await before;
    try {
      return await work();
    } finally {
      release();
    }
  }

  async function runOnce<T>(writable: boolean, work: (tx: EngineTransaction) => Promise<T>): Promise<StoreResult<T>> {
    try {
      const { transaction, ops, close } = openTransaction(bridge, writable, maxBatchBytes);
      let value: T;
      try {
        value = await work(transaction);
      } finally {
        close(); // late calls from work that did not await them are refused
      }
      if (ops.length > 0) await bridge.commit(ops);
      return { ok: true, value };
    } catch (error) {
      return storeFailureFromBridge(error);
    }
  }

  return { run: (mode, work) => (mode === 'readonly' ? runOnce(false, work) : exclusively(() => runOnce(true, work))) };
}
