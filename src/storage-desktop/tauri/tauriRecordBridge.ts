import type { RecordBridge } from '../RecordBridge';
import { guarded } from './tauriFailure';
import type { TauriInvoke } from './tauriInvoke';
import { decodeEntries, decodeOptionalBytes, encodeCommitBody } from './wireFrames';

/** The record store (storage-backends R4, R7) as the `db_get`, `db_list` and `db_commit` commands; the commit goes as one raw body (R8). */
export function createTauriRecordBridge(invoke: TauriInvoke): RecordBridge {
  return {
    get: (collection, key) => guarded(async () => decodeOptionalBytes(await invoke('db_get', { collection, key }))),
    list: (collection, query) =>
      guarded(async () => decodeEntries(await invoke('db_list', query.by === 'parent' ? { collection, parent: query.parent } : { collection }))),
    commit: (ops) =>
      guarded(async () => {
        await invoke('db_commit', encodeCommitBody(ops), { headers: {} });
      }),
  };
}
