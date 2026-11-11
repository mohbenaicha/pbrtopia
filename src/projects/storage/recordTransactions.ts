import { StoreAbort, storeFailure, type StoreError, type StoreResult } from '../storeError';

// The IndexedDB plumbing every app's record database shares: open with a store layout, and run work in one transaction with failures as values.

export function failureFrom(error: unknown): { ok: false; error: StoreError } {
  if (error instanceof StoreAbort) return { ok: false, error: error.storeError };
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'QuotaExceededError') return storeFailure('quota-exceeded', 'There is no room left to save. Free up space or export your projects.');
  if (name === 'AbortError') return storeFailure('aborted', 'The save was cancelled.');
  return storeFailure('storage-unavailable', 'The browser would not read or save your projects.');
}

export const settle = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** Opens (creating the stores on first use) the named database; a version change elsewhere closes this connection. */
export async function openRecordDatabase(factory: IDBFactory | undefined, name: string, version: number, createStores: (db: IDBDatabase) => void): Promise<StoreResult<IDBDatabase>> {
  if (!factory) return storeFailure('storage-unavailable', 'This browser cannot store projects.');
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name, version);
      request.onupgradeneeded = () => createStores(request.result);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.onversionchange = () => db.close();
    return { ok: true, value: db };
  } catch (error) {
    return failureFrom(error);
  }
}

/**
 * Runs the work in one transaction: all its writes are kept, or none are. Failures come back as values.
 * The work must await only the transaction's own calls: awaiting anything else lets the browser commit early, which cannot be undone
 * (a failure after that is reported as an interrupted save).
 */
export async function runRecordTransaction<Tx, T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, wrap: (tx: IDBTransaction) => Tx, work: (tx: Tx) => Promise<T>): Promise<StoreResult<T>> {
  try {
    const tx = db.transaction(stores, mode);
    const finished = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new DOMException('The save was cancelled.', 'AbortError'));
    });
    finished.catch(() => undefined); // handled below; keeps an early abort from counting as unhandled
    let value: T;
    try {
      value = await work(wrap(tx));
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // already finished or aborted
      }
      const committed = await finished.then(() => true, () => false);
      if (committed) return storeFailure('storage-unavailable', 'The save stopped part-way and some of it was kept.'); // the work awaited something other than the database, so the browser committed early
      throw error;
    }
    await finished;
    return { ok: true, value };
  } catch (error) {
    return failureFrom(error);
  }
}
