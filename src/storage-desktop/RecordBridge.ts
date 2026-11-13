/** One change to the record store. `parent` and `sort` are the keys the store indexes: the adapters choose them, the store knows nothing of projects. */
export type RecordOp =
  | { op: 'put'; collection: string; key: string; parent?: string; sort?: string; value: Uint8Array }
  | { op: 'remove'; collection: string; key: string }
  | { op: 'removeByParent'; collection: string; parent: string };

export type RecordQuery = { by: 'sortDescending' } | { by: 'parent'; parent: string };

/** A stored record as listed: its key, the indexed keys it was put with (when it had them) and its bytes. */
export interface RecordEntry {
  key: string;
  parent?: string;
  sort?: string;
  value: Uint8Array;
}

/**
 * The record store on the desktop side (one SQLite file, storage-backends R4, R7). Reads see committed data only.
 * Collections are separate key spaces; records without a `sort` are left out of `sortDescending`.
 */
export interface RecordBridge {
  get(collection: string, key: string): Promise<Uint8Array | null>;
  /** `sortDescending`: by `sort`, largest first, ties by key largest first. `parent`: that parent's records by key. */
  list(collection: string, query: RecordQuery): Promise<RecordEntry[]>;
  /** Applies the ops in order as one transaction: throws a `BridgeError` and changes nothing when any of them fails. */
  commit(ops: RecordOp[]): Promise<void>;
}
