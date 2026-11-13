import { BridgeError, type BridgeErrorKind } from '../../../src/storage-desktop/bridgeError';
import type { RecordBridge, RecordOp } from '../../../src/storage-desktop/RecordBridge';

interface StoredRecord {
  parent: string | undefined;
  sort: string | undefined;
  value: Uint8Array;
}
type Collections = Map<string, Map<string, StoredRecord>>;

export interface MemoryRecordBridge extends RecordBridge {
  /** Makes the next commit throw this kind and change nothing (tests only). */
  failNextCommit(kind: BridgeErrorKind): void;
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0); // code-unit order, like IndexedDB

/** A stand-in for the Rust record store: a batch is applied to a copy and swapped in only when every op worked. */
export function createMemoryRecordBridge(): MemoryRecordBridge {
  let committed: Collections = new Map();
  let injected: BridgeErrorKind | null = null;

  const recordsOf = (collection: string): Map<string, StoredRecord> => committed.get(collection) ?? new Map();

  function apply(draft: Collections, op: RecordOp): void {
    const records = draft.get(op.collection) ?? new Map<string, StoredRecord>();
    draft.set(op.collection, records);
    if (op.op === 'put') {
      if (!(op.value instanceof Uint8Array)) throw new BridgeError('io', 'A record value must be bytes.');
      records.set(op.key, { parent: op.parent, sort: op.sort, value: op.value.slice() });
    } else if (op.op === 'remove') {
      records.delete(op.key);
    } else {
      for (const [key, record] of [...records]) if (record.parent === op.parent) records.delete(key);
    }
  }

  return {
    failNextCommit(kind) {
      injected = kind;
    },
    async get(collection, key) {
      return recordsOf(collection).get(key)?.value.slice() ?? null;
    },
    async list(collection, query) {
      const entries = [...recordsOf(collection)].map(([key, record]) => ({ key, record }));
      const chosen =
        query.by === 'parent'
          ? entries.filter((entry) => entry.record.parent === query.parent).sort((a, b) => compare(a.key, b.key))
          : entries
              .filter((entry) => entry.record.sort !== undefined)
              .sort((a, b) => compare(a.record.sort!, b.record.sort!) || compare(a.key, b.key))
              .reverse();
      return chosen.map(({ key, record }) => ({
        key,
        ...(record.parent !== undefined && { parent: record.parent }),
        ...(record.sort !== undefined && { sort: record.sort }),
        value: record.value.slice(),
      }));
    },
    async commit(ops) {
      if (injected !== null) {
        const kind = injected;
        injected = null;
        throw new BridgeError(kind, 'The commit was refused (simulated).');
      }
      const draft: Collections = new Map([...committed].map(([collection, records]) => [collection, new Map(records)]));
      for (const op of ops) apply(draft, op);
      committed = draft;
    },
  };
}
